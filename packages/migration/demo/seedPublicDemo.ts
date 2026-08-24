import { closeDatabase, getDatabase, sql } from '@rita-berenice/server/db';
import {
	characters,
	chatTurns,
	credentials,
	documents,
	finalizationJobs,
	histories,
	lores,
	memoryEmbeddings,
	profiles,
	recaps,
	sessions,
	terms,
	users,
} from '@rita-berenice/server/db';
import { buildPublicDemoFixture, PUBLIC_DEMO_IDS } from './demoFixture.js';

const args = process.argv.slice(2).filter((argument) => argument !== '--');
const apply = args.includes('--apply');
const reset = args.includes('--reset');

const getArg = (name: string): string | undefined => {
	const index = args.indexOf(`--${name}`);
	return index >= 0 ? args[index + 1] : undefined;
};

// Defaults to the anonymous demo owner. Pass a real Rita user id to seed the
// conversation under an account that can sign in; every scope check and every
// --reset delete below is keyed off this value, so the blast radius follows the
// owner rather than staying pinned to the built-in id.
const ownerUserId = getArg('owner-user-id') ?? PUBLIC_DEMO_IDS.userId;
if (!ownerUserId.trim()) {
	throw new Error('--owner-user-id requires a non-empty value.');
}

const fixture = buildPublicDemoFixture(ownerUserId);
const expectedTurnIds = new Set(fixture.turns.map((turn) => turn.chatTurnId));
const expectedTermIds = new Set(fixture.terms.map((term) => term.termId));
const expectedDocumentIds = new Set(fixture.documents.map((document) => document.documentId));
const db = getDatabase();

try {
	const [
		userRows,
		characterRows,
		sessionRows,
		profileRows,
		turnRows,
		loreRows,
		historyRows,
		recapRows,
		documentRows,
		finalizationRows,
		credentialRows,
		termRows,
	] = await Promise.all([
		db.execute<{ user_id: string; email: string; show_name: string }>(sql`
			select user_id, email, show_name from users
			where user_id = ${ownerUserId}
				or email = ${fixture.user.email}
				or show_name = ${fixture.user.showName}
		`),
		db.execute<{ character_id: string; user_id: string }>(sql`
			select character_id, user_id from characters
			where character_id = ${PUBLIC_DEMO_IDS.characterId}
		`),
		db.execute<{ session_id: string; user_id: string; character_id: string }>(sql`
			select session_id, user_id, character_id from sessions
			where session_id = ${PUBLIC_DEMO_IDS.sessionId}
		`),
		db.execute<{ profile_id: string; user_id: string; session_id: string }>(sql`
			select profile_id, user_id, session_id from profiles
			where session_id = ${PUBLIC_DEMO_IDS.sessionId}
				or profile_id = ${fixture.profile.profileId}
		`),
		db.execute<{ chat_turn_id: string }>(sql`
			select chat_turn_id from chat_turns
			where session_id = ${PUBLIC_DEMO_IDS.sessionId}
		`),
		db.execute<{ lore_id: string; user_id: string }>(sql`
			select lore_id, user_id from lores
			where user_id = ${ownerUserId}
				or lore_id in (${PUBLIC_DEMO_IDS.worldLoreId}, ${PUBLIC_DEMO_IDS.mapLoreId})
		`),
		db.execute<{ history_id: string; user_id: string }>(sql`
			select history_id, user_id from histories
			where user_id = ${ownerUserId}
				or history_id = ${PUBLIC_DEMO_IDS.historyId}
		`),
		db.execute<{ recap_id: string; user_id: string; session_id: string }>(sql`
			select recap_id, user_id, session_id from recaps
			where session_id = ${PUBLIC_DEMO_IDS.sessionId}
		`),
		db.execute<{
			document_id: string;
			user_id: string;
			session_id: string;
			character_id: string;
		}>(sql`
			select document_id, user_id, session_id, character_id from documents
			where session_id = ${PUBLIC_DEMO_IDS.sessionId}
				or document_id in (
					${PUBLIC_DEMO_IDS.manualDraftDocumentId},
					${PUBLIC_DEMO_IDS.generatedDraftDocumentId},
					${PUBLIC_DEMO_IDS.approvedRagDocumentId},
					${PUBLIC_DEMO_IDS.approvedNoRagDocumentId},
					${PUBLIC_DEMO_IDS.archivedDocumentId}
				)
		`),
		db.execute<{ job_id: string; session_id: string }>(sql`
			select job_id, session_id from finalization_jobs
			where session_id = ${PUBLIC_DEMO_IDS.sessionId}
		`),
		db.execute<{ user_id: string }>(sql`
			select user_id from credentials where user_id = ${ownerUserId}
		`),
		db.execute<{ term_id: string; session_id: string | null }>(sql`
			select term_id, session_id from terms
			where session_id = ${PUBLIC_DEMO_IDS.sessionId}
		`),
	]);

	const conflicts: string[] = [];
	for (const row of userRows.rows) {
		if (row.user_id !== ownerUserId) {
			conflicts.push(`Demo email or show name already belongs to user '${row.user_id}'.`);
		}
	}
	for (const row of characterRows.rows) {
		if (row.user_id !== ownerUserId) {
			conflicts.push(`Demo character ID already belongs to user '${row.user_id}'.`);
		}
	}
	for (const row of sessionRows.rows) {
		if (row.user_id !== ownerUserId || row.character_id !== PUBLIC_DEMO_IDS.characterId) {
			conflicts.push(`Demo session ID already belongs to another user or character.`);
		}
	}
	for (const row of profileRows.rows) {
		if (row.user_id !== ownerUserId || row.session_id !== PUBLIC_DEMO_IDS.sessionId) {
			conflicts.push(`Demo profile already belongs to another user or session.`);
		}
	}
	for (const row of turnRows.rows) {
		if (!reset && !expectedTurnIds.has(row.chat_turn_id)) {
			conflicts.push(`Demo session contains unexpected turn '${row.chat_turn_id}'.`);
		}
	}
	for (const row of loreRows.rows) {
		if (row.user_id !== ownerUserId) {
			conflicts.push(`Demo lore ID '${row.lore_id}' belongs to user '${row.user_id}'.`);
		}
	}
	for (const row of historyRows.rows) {
		if (row.user_id !== ownerUserId) {
			conflicts.push(`Demo history ID '${row.history_id}' belongs to user '${row.user_id}'.`);
		}
	}
	for (const row of recapRows.rows) {
		if (row.user_id !== ownerUserId || row.session_id !== PUBLIC_DEMO_IDS.sessionId) {
			conflicts.push(`Demo recap '${row.recap_id}' belongs to another user or session.`);
		}
	}
	for (const row of documentRows.rows) {
		if (
			row.user_id !== ownerUserId ||
			row.session_id !== PUBLIC_DEMO_IDS.sessionId ||
			row.character_id !== PUBLIC_DEMO_IDS.characterId ||
			(!reset && !expectedDocumentIds.has(row.document_id))
		) {
			conflicts.push(`Demo document '${row.document_id}' is outside the deterministic fixture.`);
		}
	}
	for (const row of finalizationRows.rows) {
		if (row.session_id !== PUBLIC_DEMO_IDS.sessionId) {
			conflicts.push(`Demo finalization job '${row.job_id}' belongs to another session.`);
		}
	}
	for (const row of termRows.rows) {
		if (
			row.session_id !== PUBLIC_DEMO_IDS.sessionId ||
			(!reset && !expectedTermIds.has(row.term_id))
		) {
			conflicts.push(`Demo glossary term '${row.term_id}' is outside the deterministic fixture.`);
		}
	}

	const summary = {
		mode: apply ? (reset ? 'reset-and-apply' : 'apply') : reset ? 'reset-dry-run' : 'dry-run',
		safeToApply: conflicts.length === 0,
		ids: PUBLIC_DEMO_IDS,
		ownerUserId,
		ownerIsDefault: ownerUserId === PUBLIC_DEMO_IDS.userId,
		profileId: fixture.profile.profileId,
		turnCount: fixture.turns.length,
		loreCount: fixture.lores.length,
		historyCount: fixture.histories.length,
		recapCount: fixture.recaps.length,
		documentCount: fixture.documents.length,
		finalizationJobCount: fixture.finalizationJobs.length,
		termCount: fixture.terms.length,
		credentialPolicy: 'No credentials or API keys are seeded.',
		existing: {
			users: userRows.rows.length,
			characters: characterRows.rows.length,
			sessions: sessionRows.rows.length,
			profiles: profileRows.rows.length,
			turns: turnRows.rows.length,
			lores: loreRows.rows.length,
			histories: historyRows.rows.length,
			recaps: recapRows.rows.length,
			documents: documentRows.rows.length,
			finalizationJobs: finalizationRows.rows.length,
			credentials: credentialRows.rows.length,
			terms: termRows.rows.length,
		},
		conflicts,
		transcript: fixture.turns.map((turn) => ({
			sequence: turn.sequence,
			request: turn.request.entries.map((entry) => entry.prompt),
			response: turn.response.entries.map((entry) => entry.prompt),
		})),
	};
	console.log(JSON.stringify(summary, null, 2));

	if (conflicts.length > 0) {
		throw new Error('Public demo seed preflight found conflicts; no changes were applied.');
	}

	if (!apply) {
		console.log(
			reset
				? 'Reset dry run only. Re-run with --reset --apply after reviewing the scope.'
				: 'Dry run only. Re-run with --apply after reviewing the transcript.'
		);
	} else {
		await db.transaction(async (tx) => {
			if (reset) {
				await tx.delete(memoryEmbeddings).where(sql`${memoryEmbeddings.userId} = ${ownerUserId}`);
				await tx
					.delete(finalizationJobs)
					.where(sql`${finalizationJobs.sessionId} = ${PUBLIC_DEMO_IDS.sessionId}`);
				await tx.delete(recaps).where(sql`${recaps.sessionId} = ${PUBLIC_DEMO_IDS.sessionId}`);
				await tx
					.delete(documents)
					.where(
						sql`${documents.userId} = ${ownerUserId} or ${documents.sessionId} = ${PUBLIC_DEMO_IDS.sessionId}`
					);
				await tx.delete(histories).where(sql`${histories.userId} = ${ownerUserId}`);
				await tx.delete(lores).where(sql`${lores.userId} = ${ownerUserId}`);
				await tx.delete(chatTurns).where(sql`${chatTurns.sessionId} = ${PUBLIC_DEMO_IDS.sessionId}`);
				await tx.delete(profiles).where(sql`${profiles.sessionId} = ${PUBLIC_DEMO_IDS.sessionId}`);
				await tx.delete(terms).where(sql`${terms.sessionId} = ${PUBLIC_DEMO_IDS.sessionId}`);
				await tx.delete(sessions).where(sql`${sessions.sessionId} = ${PUBLIC_DEMO_IDS.sessionId}`);
				await tx.delete(characters).where(sql`${characters.userId} = ${ownerUserId}`);
				await tx.delete(credentials).where(sql`${credentials.userId} = ${ownerUserId}`);
				await tx.delete(users).where(sql`${users.userId} = ${ownerUserId}`);
			}

			await tx
				.insert(users)
				.values({
					userId: fixture.user.userId,
					email: fixture.user.email,
					showName: fixture.user.showName,
					data: fixture.user,
					createdAt: fixture.user.createdAt,
					updatedAt: fixture.user.updatedAt,
				})
				// The seed owns the demo conversation, never the account behind it: create the
				// user row when it is missing, leave an existing one untouched.
				.onConflictDoNothing({ target: users.userId });
			await tx
				.insert(characters)
				.values({
					characterId: fixture.character.characterId,
					userId: fixture.character.userId,
					showName: fixture.character.showName,
					data: fixture.character,
					createdAt: fixture.character.createdAt,
					updatedAt: fixture.character.updatedAt,
				})
				.onConflictDoUpdate({
					target: characters.characterId,
					set: {
						userId: fixture.character.userId,
						showName: fixture.character.showName,
						data: fixture.character,
					},
				});
			await tx
				.insert(sessions)
				.values({
					sessionId: fixture.session.sessionId,
					userId: fixture.session.userId,
					characterId: fixture.session.characterId,
					profileId: fixture.session.profileId,
					status: fixture.session.status,
					data: fixture.session,
					createdAt: fixture.session.createdAt,
					updatedAt: fixture.session.updatedAt,
				})
				.onConflictDoUpdate({
					target: sessions.sessionId,
					set: {
						userId: fixture.session.userId,
						characterId: fixture.session.characterId,
						profileId: fixture.session.profileId,
						status: fixture.session.status,
						data: fixture.session,
					},
				});
			await tx
				.insert(profiles)
				.values({
					profileId: fixture.profile.profileId,
					sessionId: fixture.profile.sessionId,
					userId: fixture.profile.userId,
					showName: fixture.profile.showName,
					data: fixture.profile,
					createdAt: fixture.profile.createdAt,
					updatedAt: fixture.profile.updatedAt,
				})
				.onConflictDoUpdate({
					target: profiles.profileId,
					set: {
						sessionId: fixture.profile.sessionId,
						userId: fixture.profile.userId,
						showName: fixture.profile.showName,
						data: fixture.profile,
					},
				});

			for (const turn of fixture.turns) {
				await tx
					.insert(chatTurns)
					.values({
						chatTurnId: turn.chatTurnId,
						sessionId: turn.sessionId,
						characterId: turn.characterId,
						profileId: turn.profileId,
						userId: turn.userId,
						sequence: turn.sequence,
						data: turn,
						createdAt: turn.createdAt,
						updatedAt: turn.updatedAt,
					})
					.onConflictDoUpdate({
						target: chatTurns.chatTurnId,
						set: {
							sessionId: turn.sessionId,
							characterId: turn.characterId,
							profileId: turn.profileId,
							userId: turn.userId,
							sequence: turn.sequence,
							data: turn,
						},
					});
			}

			for (const lore of fixture.lores) {
				await tx
					.insert(lores)
					.values({
						loreId: lore.loreId,
						userId: lore.userId,
						loreType: lore.type,
						category: lore.category,
						data: lore,
						createdAt: lore.createdAt,
						updatedAt: lore.updatedAt,
					})
					.onConflictDoUpdate({
						target: lores.loreId,
						set: { userId: lore.userId, loreType: lore.type, category: lore.category, data: lore },
					});
			}

			for (const history of fixture.histories) {
				await tx
					.insert(histories)
					.values({
						historyId: history.historyId,
						characterId: history.characterId,
						userId: history.userId,
						category: history.category,
						data: history,
						createdAt: history.createdAt,
						updatedAt: history.updatedAt,
					})
					.onConflictDoUpdate({
						target: histories.historyId,
						set: {
							characterId: history.characterId,
							userId: history.userId,
							category: history.category,
							data: history,
						},
					});
			}

			for (const recap of fixture.recaps) {
				await tx
					.insert(recaps)
					.values({
						recapId: recap.recapId,
						sessionId: recap.sessionId,
						characterId: recap.characterId,
						userId: recap.userId,
						recapType: recap.type,
						turnStart: recap.turnStart,
						turnEnd: recap.turnEnd,
						data: recap,
						createdAt: recap.createdAt,
						updatedAt: recap.updatedAt,
					})
					.onConflictDoUpdate({
						target: recaps.recapId,
						set: {
							recapType: recap.type,
							turnStart: recap.turnStart,
							turnEnd: recap.turnEnd,
							data: recap,
						},
					});
			}

			for (const document of fixture.documents) {
				await tx
					.insert(documents)
					.values({
						documentId: document.documentId,
						userId: document.userId,
						sessionId: document.sessionId,
						characterId: document.characterId,
						origin: document.origin,
						status: document.status,
						retrievalEnabled: document.retrievalEnabled,
						data: document,
						createdAt: document.createdAt,
						updatedAt: document.updatedAt,
					})
					.onConflictDoUpdate({
						target: documents.documentId,
						set: {
							userId: document.userId,
							sessionId: document.sessionId,
							characterId: document.characterId,
							origin: document.origin,
							status: document.status,
							retrievalEnabled: document.retrievalEnabled,
							data: document,
							updatedAt: document.updatedAt,
						},
					});
			}

			for (const term of fixture.terms) {
				await tx
					.insert(terms)
					.values({
						termId: term.termId,
						termType: term.type,
						scopeId: term.sessionId,
						characterId: term.characterId,
						sessionId: term.sessionId,
						koreanTerm: term.koreanTerm,
						englishTerm: term.englishTerm,
						data: term,
						createdAt: term.createdAt,
						updatedAt: term.updatedAt,
					})
					.onConflictDoUpdate({
						target: terms.termId,
						set: {
							koreanTerm: term.koreanTerm,
							englishTerm: term.englishTerm,
							data: term,
							updatedAt: term.updatedAt,
						},
					});
			}

			for (const job of fixture.finalizationJobs) {
				await tx
					.insert(finalizationJobs)
					.values(job)
					.onConflictDoUpdate({
						target: finalizationJobs.jobId,
						set: {
							status: job.status,
							attempts: job.attempts,
							maxAttempts: job.maxAttempts,
							input: job.input,
							result: job.result,
							error: job.error,
							lockedAt: job.lockedAt,
							updatedAt: job.updatedAt,
						},
					});
			}
		});

		console.log(
			`Public demo fixture applied. Set PUBLIC_DEMO_SESSION_ID=${PUBLIC_DEMO_IDS.sessionId}.`
		);
	}
} finally {
	await closeDatabase();
}
