import { buildProfileId } from '@rita-berenice/shared/util';
import { closeDatabase, getDatabase, sql } from '@rita-berenice/server/db';

const SESSION_ID = 'monday_original_1sYD76a4';
const CHARACTER_ID = 'monday_original';

const args = process.argv.slice(2).filter((argument) => argument !== '--');
const targetUserId = args.find((argument) => !argument.startsWith('--'));
const apply = args.includes('--apply');

if (!targetUserId || targetUserId.startsWith('--')) {
	throw new Error('Usage: monday:transfer <target-user-id> [--apply]');
}

const db = getDatabase();

try {
	const sessionResult = await db.execute<{ user_id: string; profile_id: string }>(sql`
		select user_id, profile_id
		from sessions
		where session_id = ${SESSION_ID}
	`);
	const sourceSession = sessionResult.rows[0];
	if (!sourceSession) {
		throw new Error(`Monday session '${SESSION_ID}' was not found.`);
	}

	const sourceUserId = sourceSession.user_id;
	const sourceProfileId = sourceSession.profile_id;
	const targetProfileId = buildProfileId(SESSION_ID, targetUserId);

	const targetResult = await db.execute<{ user_id: string; email: string }>(sql`
		select user_id, email
		from users
		where user_id = ${targetUserId}
	`);
	const targetUser = targetResult.rows[0];
	if (!targetUser) {
		throw new Error(
			`Target user '${targetUserId}' does not exist. Log in and load /api/user/get-me first.`
		);
	}

	const inventoryResult = await db.execute<{
		characters: number;
		sessions: number;
		profiles: number;
		temp_chat_turns: number;
		chat_turns: number;
		lores: number;
		histories: number;
		recaps: number;
		finalization_jobs: number;
		memory_embeddings: number;
	}>(sql`
		select
			(select count(*)::int from characters where character_id = ${CHARACTER_ID}) as characters,
			(select count(*)::int from sessions where session_id = ${SESSION_ID}) as sessions,
			(select count(*)::int from profiles where session_id = ${SESSION_ID}) as profiles,
			(select count(*)::int from temp_chat_turns where session_id = ${SESSION_ID}) as temp_chat_turns,
			(select count(*)::int from chat_turns where session_id = ${SESSION_ID}) as chat_turns,
			(select count(*)::int from lores where user_id = ${sourceUserId} and data ->> 'characterId' = ${CHARACTER_ID}) as lores,
			(select count(*)::int from histories where user_id = ${sourceUserId} and character_id = ${CHARACTER_ID}) as histories,
			(select count(*)::int from recaps where session_id = ${SESSION_ID}) as recaps,
			(select count(*)::int from finalization_jobs where session_id = ${SESSION_ID}) as finalization_jobs,
			(select count(*)::int from memory_embeddings
				where user_id = ${sourceUserId}
				and (session_id = ${SESSION_ID} or character_id = ${CHARACTER_ID})
			) as memory_embeddings
	`);

	const summary = {
		mode: apply ? 'apply' : 'dry-run',
		sessionId: SESSION_ID,
		characterId: CHARACTER_ID,
		sourceUserId,
		targetUserId,
		targetEmail: targetUser.email,
		sourceProfileId,
		targetProfileId,
		rows: inventoryResult.rows[0],
	};
	console.log(JSON.stringify(summary, null, 2));

	if (!apply) {
		console.log('Dry run only. Re-run with --apply after reviewing this inventory.');
	} else if (sourceUserId === targetUserId) {
		console.log('Monday data already belongs to the target user. No changes applied.');
	} else {
		await db.transaction(async (tx) => {
			const targetProfile = await tx.execute(sql`
				select 1 from profiles where profile_id = ${targetProfileId}
			`);
			if (targetProfile.rows.length > 0 && sourceProfileId !== targetProfileId) {
				throw new Error(`Target profile '${targetProfileId}' already exists.`);
			}

			await tx.execute(sql`
				update characters
				set user_id = ${targetUserId},
					data = jsonb_set(data, '{userId}', to_jsonb(${targetUserId}::text), true)
				where character_id = ${CHARACTER_ID}
			`);
			await tx.execute(sql`
				update sessions
				set user_id = ${targetUserId},
					profile_id = ${targetProfileId},
					data = jsonb_set(
						jsonb_set(data, '{userId}', to_jsonb(${targetUserId}::text), true),
						'{profileId}', to_jsonb(${targetProfileId}::text), true
					)
				where session_id = ${SESSION_ID}
			`);
			await tx.execute(sql`
				update profiles
				set profile_id = ${targetProfileId},
					user_id = ${targetUserId},
					data = jsonb_set(
						jsonb_set(data, '{userId}', to_jsonb(${targetUserId}::text), true),
						'{profileId}', to_jsonb(${targetProfileId}::text), true
					)
				where session_id = ${SESSION_ID}
			`);
			await tx.execute(sql`
				update chat_turns
				set user_id = ${targetUserId},
					profile_id = ${targetProfileId},
					data = jsonb_set(
						jsonb_set(data, '{userId}', to_jsonb(${targetUserId}::text), true),
						'{profileId}', to_jsonb(${targetProfileId}::text), true
					)
				where session_id = ${SESSION_ID}
			`);
			await tx.execute(sql`
				update temp_chat_turns
				set user_id = ${targetUserId},
					data = jsonb_set(
						jsonb_set(data, '{userId}', to_jsonb(${targetUserId}::text), true),
						'{profileId}', to_jsonb(${targetProfileId}::text), true
					)
				where session_id = ${SESSION_ID}
			`);
			await tx.execute(sql`
				update recaps
				set user_id = ${targetUserId},
					data = jsonb_set(data, '{userId}', to_jsonb(${targetUserId}::text), true)
				where session_id = ${SESSION_ID}
			`);
			await tx.execute(sql`
				update lores
				set user_id = ${targetUserId},
					data = jsonb_set(data, '{userId}', to_jsonb(${targetUserId}::text), true)
				where user_id = ${sourceUserId}
					and data ->> 'characterId' = ${CHARACTER_ID}
			`);
			await tx.execute(sql`
				update histories
				set user_id = ${targetUserId},
					data = jsonb_set(data, '{userId}', to_jsonb(${targetUserId}::text), true)
				where user_id = ${sourceUserId} and character_id = ${CHARACTER_ID}
			`);
			await tx.execute(sql`
				update memory_embeddings
				set user_id = ${targetUserId},
					source_id = case when source_id = ${sourceProfileId} then ${targetProfileId} else source_id end,
					metadata = jsonb_set(
						jsonb_set(metadata, '{userId}', to_jsonb(${targetUserId}::text), true),
						'{profileId}', to_jsonb(${targetProfileId}::text), true
					)
				where user_id = ${sourceUserId}
					and (session_id = ${SESSION_ID} or character_id = ${CHARACTER_ID})
			`);
			await tx.execute(sql`
				update finalization_jobs
				set input = jsonb_set(
						jsonb_set(input, '{userId}', to_jsonb(${targetUserId}::text), true),
						'{profileId}', to_jsonb(${targetProfileId}::text), true
					),
					result = case
						when result is null then null
						else jsonb_set(
							jsonb_set(result, '{userId}', to_jsonb(${targetUserId}::text), true),
							'{profileId}', to_jsonb(${targetProfileId}::text), true
						)
					end
				where session_id = ${SESSION_ID}
			`);
		});
		console.log('Monday ownership transfer committed successfully.');
	}
} finally {
	await closeDatabase();
}
