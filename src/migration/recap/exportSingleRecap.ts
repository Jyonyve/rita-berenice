// src/migration/recap/exportSingleRecap.ts

import { chromaDbClient, handleServiceError, buildRecapId } from '#server/index.js';
import { METADATA_TYPES } from '#shared/index.js';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

// --- Configuration ---
const OUTPUT_DIR = './src/migration/recap/exported';
// Target session selection
// const MONDAY_ORIGINAL_SESSIONID = 'monday_original_moH1Pu9n3BXz3OmY';
// const TARION_ORIGINAL_SESSIONID = 'tarion_original_1NkO7v690JDWN9Ey';
const TARION_SPINOFF_SESSIONID = 'tarion_spinoff_U2Hc22mzJufwQvSX';

// 사용할 때 변경하세요
// const TARGET_RECAP_ID = buildRecapId(MONDAY_ORIGINAL_SESSIONID);
// const TARGET_RECAP_ID = buildRecapId(TARION_ORIGINAL_SESSIONID);
// const TARGET_RECAP_ID = buildRecapId(TARION_SPINOFF_SESSIONID);
// const TARGET_RECAP_ID = buildRelationshipRecapId(MONDAY_ORIGINAL_SESSIONID);
// const TARGET_RECAP_ID = buildRelationshipRecapId(TARION_ORIGINAL_SESSIONID);
// const TARGET_RECAP_ID = buildRelationshipRecapId(TARION_SPINOFF_SESSIONID);

const TARGET_METADATA_TYPE = METADATA_TYPES.RECAP; // 또는 METADATA_TYPES.RELATIONSHIP, METADATA_TYPES.STORY
// const TARGET_METADATA_TYPE = METADATA_TYPES.RELATIONSHIP; // 또는 METADATA_TYPES.RELATIONSHIP, METADATA_TYPES.STORY

// --- Utility Functions ---
const ensureDirectoryExists = async (dirPath: string): Promise<void> => {
	try {
		await mkdir(dirPath, { recursive: true });
	} catch (error) {
		// 디렉토리가 이미 존재할 수 있으므로 에러 무시
	}
};

const sanitizeFileName = (fileName: string): string => {
	return fileName.replace(/[<>:"/\\|?*]/g, '_');
};

/**
 * ChromaDB에서 특정 recap 문서를 가져와서 MD 파일로 저장합니다.
 */
const exportSingleRecapById = async (recapId: string, metadataType: string): Promise<void> => {
	console.log('🚀 Starting single recap export...');
	console.log(`Target recap ID: ${recapId}`);
	console.log(`Target metadata type: ${metadataType}`);

	try {
		// 출력 디렉토리 생성
		await ensureDirectoryExists(OUTPUT_DIR);

		// ChromaDB에서 recap 컬렉션 가져오기
		const collection = await chromaDbClient.getRecapCollection();

		// 특정 ID로 문서 가져오기
		console.log(`📖 Fetching document with ID: ${recapId}`);
		const result = await chromaDbClient.getRecordById(collection, recapId);

		if (!result || result.ids.length === 0) {
			console.log(`⚠️ No document found with ID: ${recapId}`);
			return;
		}

		const document = result.documents[0];
		const metadata = result.metadatas[0];

		if (!document || document.trim() === '') {
			console.log(`⚠️ Document found but content is empty for ID: ${recapId}`);
			return;
		}

		// 메타데이터 타입 확인
		if (metadata?.type !== metadataType) {
			console.log(`⚠️ Document type mismatch. Expected: ${metadataType}, Found: ${metadata?.type}`);
			console.log(`Proceeding with export anyway...`);
		}

		// 파일명 생성
		const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
		const sanitizedId = sanitizeFileName(recapId);
		const fileName = `${sanitizedId}_${timestamp}.md`;
		const filePath = path.join(OUTPUT_DIR, fileName);

		// 파일 내용 생성
		const fileContent = `# Recap Document

**Document ID:** ${recapId}
**Exported on:** ${new Date().toISOString()}
**Metadata Type:** ${metadata?.type || 'Unknown'}
**Session ID:** ${metadata?.sessionId || 'Unknown'}
**Original Timestamp:** ${metadata?.timestamp || 'Unknown'}
${metadata?.sequence ? `**Sequence:** ${metadata.sequence}` : ''}
${metadata?.recapType ? `**Recap Type:** ${metadata.recapType}` : ''}
${metadata?.nsfw !== undefined ? `**NSFW:** ${metadata.nsfw}` : ''}

---

${document}
`;

		// 파일 저장
		await writeFile(filePath, fileContent, 'utf-8');
		console.log(`✅ Document exported successfully!`);
		console.log(`📄 File saved to: ${filePath}`);

		// 메타데이터 정보 출력
		console.log('\n📊 Document Info:');
		console.log(`  Content length: ${document.length} characters`);
		console.log(`  Session ID: ${metadata?.sessionId || 'N/A'}`);
		console.log(`  Type: ${metadata?.type || 'N/A'}`);
		console.log(`  Timestamp: ${metadata?.timestamp || 'N/A'}`);
	} catch (error) {
		handleServiceError(
			error,
			`Error exporting recap document with ID ${recapId}`,
			`Failed to export recap document`
		);
		console.error('❌ Export failed:', error);
		process.exit(1);
	}
};

// 스크립트 실행
// exportSingleRecapById(TARGET_RECAP_ID, TARGET_METADATA_TYPE);
