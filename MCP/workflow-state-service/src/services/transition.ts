import type { Kysely } from 'kysely';
import type { Database } from '../db/schema.ts';
import type { PhaseConfig, ProgressState, TransitionRule } from '../types.ts';
import { getState } from './workflow.ts';
import { getEvidence } from './evidence.ts';
import { internalAppendEvent } from './event-emitter.ts';

function createToolError(code: string, message: string): never {
  const err = new Error(message) as Error & { code: string };
  err.code = code;
  throw err;
}

function nowISO(): string {
  return new Date().toISOString();
}

interface GateEvaluation {
  evidenceCategory: string;
  condition: string;
  description: string;
  latestResult: string | null;
  met: boolean;
}

export async function transitionPhase(
  db: Kysely<Database>,
  workflowId: string,
  params: {
    from: string;
    to: string;
    summary: string;
    actorKind: string;
    actorName: string;
  },
): Promise<{
  approved: boolean;
  state?: ProgressState;
  stateVersion?: number;
  warnings: string[];
  unmetGates: GateEvaluation[];
}> {
  if (params.actorKind !== 'coordinator') {
    createToolError('FORBIDDEN', 'Only coordinator actorKind can trigger transitions');
  }

  const { state, stateVersion, phaseConfig } = await getState(db, workflowId);

  // Verify from matches current phase
  const currentPhaseKey = findCurrentPhaseKey(state);
  if (currentPhaseKey !== params.from) {
    createToolError('STATE_CONFLICT', `Current phase is "${currentPhaseKey}", not "${params.from}"`);
  }

  // Find matching transition rule
  const transition = phaseConfig.transitions.find(
    (t: TransitionRule) => t.from === params.from && t.to === params.to,
  );
  if (!transition) {
    createToolError('INVALID_TRANSITION', `No transition defined from "${params.from}" to "${params.to}"`);
  }

  // Emit transition-requested
  await internalAppendEvent(db, workflowId, {
    eventType: 'transition-requested',
    actorKind: params.actorKind,
    actorName: params.actorName,
    phaseKey: params.from,
    payload: { from: params.from, to: params.to },
  });

  // Evaluate gate rules
  const gateEvals: GateEvaluation[] = [];
  const warnings: string[] = [];
  let allMustPassMet = true;

  for (const gate of transition.gateRules) {
    const { evidence } = await getEvidence(db, workflowId, {
      phaseKey: params.from,
      category: gate.evidenceCategory,
    });

    // Use the latest evidence
    const latest = evidence.length > 0 ? evidence[evidence.length - 1] : null;
    const latestResult = latest?.gateResult ?? null;
    const met = latestResult === 'pass';

    gateEvals.push({
      evidenceCategory: gate.evidenceCategory,
      condition: gate.condition,
      description: gate.description,
      latestResult,
      met,
    });

    if (gate.condition === 'must-pass' && !met) {
      allMustPassMet = false;
    }

    if (gate.condition === 'should-pass' && !met) {
      warnings.push(`Advisory gate not met: ${gate.description} (${gate.evidenceCategory})`);
    }
  }

  if (!allMustPassMet) {
    const unmetGates = gateEvals.filter((g) => !g.met && g.condition === 'must-pass');

    await internalAppendEvent(db, workflowId, {
      eventType: 'transition-rejected',
      actorKind: params.actorKind,
      actorName: params.actorName,
      phaseKey: params.from,
      payload: { from: params.from, to: params.to, reason: 'Unmet must-pass gates', unmetGates },
    });

    return { approved: false, warnings, unmetGates };
  }

  // Execute transition
  const now = nowISO();

  // Complete current phase
  state.phases[params.from].status = 'completed';
  state.phases[params.from].completedAt = now;
  state.phases[params.from].summary = params.summary;

  let newCurrentPhaseKey: string | null;

  if (params.to === '_close') {
    newCurrentPhaseKey = null;

    await db
      .updateTable('workflows')
      .set({ updated_at: now })
      .where('workflow_id', '=', workflowId)
      .execute();
  } else {
    // Back-edge re-entry: clear completedAt and summary
    state.phases[params.to].status = 'in-progress';
    state.phases[params.to].startedAt = now;
    state.phases[params.to].completedAt = null;
    state.phases[params.to].summary = null;
    newCurrentPhaseKey = params.to;

    await db
      .updateTable('workflows')
      .set({ updated_at: now })
      .where('workflow_id', '=', workflowId)
      .execute();
  }

  const newVersion = stateVersion + 1;

  await db
    .updateTable('workflow_state')
    .set({
      progress_state_json: JSON.stringify(state),
      current_phase_key: newCurrentPhaseKey,
      state_version: newVersion,
    })
    .where('workflow_id', '=', workflowId)
    .execute();

  // Emit events
  await internalAppendEvent(db, workflowId, {
    eventType: 'transition-approved',
    actorKind: params.actorKind,
    actorName: params.actorName,
    phaseKey: params.from,
    payload: { from: params.from, to: params.to, warnings },
  });

  await internalAppendEvent(db, workflowId, {
    eventType: 'phase-completed',
    actorKind: params.actorKind,
    actorName: params.actorName,
    phaseKey: params.from,
    payload: { phaseKey: params.from, completedAt: now, summary: params.summary },
  });

  if (params.to !== '_close') {
    await internalAppendEvent(db, workflowId, {
      eventType: 'phase-started',
      actorKind: params.actorKind,
      actorName: params.actorName,
      phaseKey: params.to,
      payload: { phaseKey: params.to, startedAt: now },
    });
  }

  return { approved: true, state, stateVersion: newVersion, warnings, unmetGates: [] };
}

function findCurrentPhaseKey(state: ProgressState): string | null {
  for (const [key, phase] of Object.entries(state.phases)) {
    if (phase.status === 'in-progress') return key;
  }
  return null;
}
