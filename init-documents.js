#!/usr/bin/env node

/**
 * 문서 관리 초기 데이터 생성 스크립트
 * 샘플 문서들을 데이터베이스에 추가합니다.
 */

require('dotenv').config();
const mysql = require('mysql2/promise');

async function initDocuments() {
    let connection;
    
    try {
        // 데이터베이스 연결
        connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASS,
            database: process.env.DB_NAME
        });
        
        console.log('데이터베이스 연결 성공');
        
        // 카테고리 확인 (기본 카테고리는 이미 서버에서 자동 생성됨)
        const [categories] = await connection.execute(
            'SELECT * FROM document_categories ORDER BY id'
        );
        
        console.log('기존 카테고리:', categories.map(c => c.name));
        
        // 샘플 문서 데이터
        const sampleDocuments = [
            {
                category_id: 1, // 사업계획서
                title: '2024년 연간 사업계획서',
                description: '이든푸드의 2024년도 사업 목표 및 실행 계획을 담은 문서입니다.',
                thumbnail: null,
                created_at: new Date('2024-01-05 09:00:00')
            },
            {
                category_id: 1, // 사업계획서
                title: '신규 매장 개설 계획서',
                description: '2024년 하반기 신규 매장 개설을 위한 상세 계획서입니다.',
                thumbnail: null,
                created_at: new Date('2024-03-15 14:30:00')
            },
            {
                category_id: 2, // 계약서양식
                title: '표준 근로계약서',
                description: '정규직 직원 채용 시 사용하는 표준 근로계약서 양식입니다.',
                thumbnail: null,
                created_at: new Date('2024-02-01 10:00:00')
            },
            {
                category_id: 2, // 계약서양식
                title: '식자재 구매 계약서',
                description: '식자재 공급업체와의 계약 시 사용하는 표준 계약서입니다.',
                thumbnail: null,
                created_at: new Date('2024-02-20 11:30:00')
            },
            {
                category_id: 3, // 운영매뉴얼
                title: '매장 운영 매뉴얼 v2.0',
                description: '이든푸드 전 매장에서 사용하는 표준 운영 매뉴얼입니다.',
                thumbnail: null,
                created_at: new Date('2024-01-10 09:30:00')
            },
            {
                category_id: 3, // 운영매뉴얼
                title: '위생관리 지침서',
                description: 'HACCP 기준에 따른 매장 위생관리 상세 지침서입니다.',
                thumbnail: null,
                created_at: new Date('2024-02-15 13:00:00')
            },
            {
                category_id: 3, // 운영매뉴얼
                title: '신입직원 교육 매뉴얼',
                description: '신규 직원 입사 시 진행하는 교육 프로그램 가이드입니다.',
                thumbnail: null,
                created_at: new Date('2024-03-01 10:00:00')
            },
            {
                category_id: 4, // 보고서양식
                title: '월간 매출 보고서 양식',
                description: '매장별 월간 매출 현황을 보고하는 표준 양식입니다.',
                thumbnail: null,
                created_at: new Date('2024-01-20 15:00:00')
            },
            {
                category_id: 4, // 보고서양식
                title: '재고 관리 보고서 양식',
                description: '주간 재고 현황 및 발주 내역 보고용 양식입니다.',
                thumbnail: null,
                created_at: new Date('2024-02-10 14:00:00')
            },
            {
                category_id: 5, // 기타서식
                title: '휴가 신청서',
                description: '직원 휴가 신청 시 사용하는 표준 서식입니다.',
                thumbnail: null,
                created_at: new Date('2024-01-25 16:00:00')
            },
            {
                category_id: 5, // 기타서식
                title: '출장 정산서',
                description: '업무 출장 후 경비 정산을 위한 서식입니다.',
                thumbnail: null,
                created_at: new Date('2024-02-25 17:00:00')
            },
            {
                category_id: 5, // 기타서식
                title: '시설물 점검표',
                description: '매장 시설물 정기 점검 시 사용하는 체크리스트입니다.',
                thumbnail: null,
                created_at: new Date('2024-03-10 11:00:00')
            }
        ];
        
        // 문서별 샘플 파일 데이터 (실제 파일 내용 대신 더미 데이터 사용)
        const sampleFiles = {
            '2024년 연간 사업계획서': [
                {
                    file_name: '2024_사업계획서_최종.pdf',
                    original_name: '2024_사업계획서_최종.pdf',
                    file_type: 'application/pdf',
                    file_size: 2457600, // 2.4MB
                    file_data: Buffer.from('샘플 PDF 데이터').toString('base64')
                }
            ],
            '신규 매장 개설 계획서': [
                {
                    file_name: '신규매장_개설계획_v1.2.pdf',
                    original_name: '신규매장_개설계획_v1.2.pdf',
                    file_type: 'application/pdf',
                    file_size: 1843200, // 1.8MB
                    file_data: Buffer.from('샘플 PDF 데이터').toString('base64')
                },
                {
                    file_name: '매장후보지_분석.xlsx',
                    original_name: '매장후보지_분석.xlsx',
                    file_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    file_size: 524288, // 512KB
                    file_data: Buffer.from('샘플 Excel 데이터').toString('base64')
                }
            ],
            '표준 근로계약서': [
                {
                    file_name: '근로계약서_양식.docx',
                    original_name: '근로계약서_양식.docx',
                    file_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    file_size: 102400, // 100KB
                    file_data: Buffer.from('샘플 Word 데이터').toString('base64')
                }
            ],
            '식자재 구매 계약서': [
                {
                    file_name: '구매계약서_양식.docx',
                    original_name: '구매계약서_양식.docx',
                    file_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    file_size: 89600, // 87.5KB
                    file_data: Buffer.from('샘플 Word 데이터').toString('base64')
                }
            ],
            '매장 운영 매뉴얼 v2.0': [
                {
                    file_name: '매장운영매뉴얼_v2.0.pdf',
                    original_name: '매장운영매뉴얼_v2.0.pdf',
                    file_type: 'application/pdf',
                    file_size: 5242880, // 5MB
                    file_data: Buffer.from('샘플 PDF 데이터').toString('base64')
                }
            ],
            '위생관리 지침서': [
                {
                    file_name: 'HACCP_위생관리_지침서.pdf',
                    original_name: 'HACCP_위생관리_지침서.pdf',
                    file_type: 'application/pdf',
                    file_size: 3145728, // 3MB
                    file_data: Buffer.from('샘플 PDF 데이터').toString('base64')
                }
            ],
            '신입직원 교육 매뉴얼': [
                {
                    file_name: '신입직원_교육매뉴얼.pdf',
                    original_name: '신입직원_교육매뉴얼.pdf',
                    file_type: 'application/pdf',
                    file_size: 2097152, // 2MB
                    file_data: Buffer.from('샘플 PDF 데이터').toString('base64')
                },
                {
                    file_name: '교육일정표.xlsx',
                    original_name: '교육일정표.xlsx',
                    file_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    file_size: 204800, // 200KB
                    file_data: Buffer.from('샘플 Excel 데이터').toString('base64')
                }
            ],
            '월간 매출 보고서 양식': [
                {
                    file_name: '월간매출보고서_양식.xlsx',
                    original_name: '월간매출보고서_양식.xlsx',
                    file_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    file_size: 153600, // 150KB
                    file_data: Buffer.from('샘플 Excel 데이터').toString('base64')
                }
            ],
            '재고 관리 보고서 양식': [
                {
                    file_name: '재고관리_보고서양식.xlsx',
                    original_name: '재고관리_보고서양식.xlsx',
                    file_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    file_size: 163840, // 160KB
                    file_data: Buffer.from('샘플 Excel 데이터').toString('base64')
                }
            ],
            '휴가 신청서': [
                {
                    file_name: '휴가신청서.docx',
                    original_name: '휴가신청서.docx',
                    file_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    file_size: 51200, // 50KB
                    file_data: Buffer.from('샘플 Word 데이터').toString('base64')
                }
            ],
            '출장 정산서': [
                {
                    file_name: '출장정산서_양식.xlsx',
                    original_name: '출장정산서_양식.xlsx',
                    file_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    file_size: 81920, // 80KB
                    file_data: Buffer.from('샘플 Excel 데이터').toString('base64')
                }
            ],
            '시설물 점검표': [
                {
                    file_name: '시설물점검표.docx',
                    original_name: '시설물점검표.docx',
                    file_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    file_size: 71680, // 70KB
                    file_data: Buffer.from('샘플 Word 데이터').toString('base64')
                }
            ]
        };
        
        // 기존 문서 확인
        const [existingDocs] = await connection.execute(
            'SELECT COUNT(*) as count FROM documents'
        );
        
        if (existingDocs[0].count > 0) {
            console.log(`이미 ${existingDocs[0].count}개의 문서가 있습니다.`);
            const answer = process.argv[2];
            if (answer !== '--force') {
                console.log('기존 데이터를 유지하고 종료합니다.');
                console.log('덮어쓰려면 --force 옵션을 사용하세요.');
                return;
            }
            console.log('기존 데이터를 삭제하고 새로 추가합니다...');
            await connection.execute('DELETE FROM document_files');
            await connection.execute('DELETE FROM documents');
        }
        
        // 문서 추가
        let addedCount = 0;
        for (const doc of sampleDocuments) {
            try {
                // 문서 추가
                const [result] = await connection.execute(
                    `INSERT INTO documents 
                    (category_id, title, description, thumbnail, download_count, created_at) 
                    VALUES (?, ?, ?, ?, 0, ?)`,
                    [doc.category_id, doc.title, doc.description, doc.thumbnail, doc.created_at]
                );
                
                const documentId = result.insertId;
                
                // 해당 문서의 파일들 추가
                const files = sampleFiles[doc.title] || [];
                for (const file of files) {
                    await connection.execute(
                        `INSERT INTO document_files 
                        (document_id, file_name, original_name, file_type, file_size, file_data) 
                        VALUES (?, ?, ?, ?, ?, ?)`,
                        [documentId, file.file_name, file.original_name, 
                         file.file_type, file.file_size, file.file_data]
                    );
                }
                
                console.log(`✓ 추가됨: ${doc.title} (파일 ${files.length}개)`);
                addedCount++;
            } catch (error) {
                console.error(`✗ 실패: ${doc.title} - ${error.message}`);
            }
        }
        
        console.log(`\n총 ${addedCount}개의 문서가 추가되었습니다.`);
        
    } catch (error) {
        console.error('오류 발생:', error);
    } finally {
        if (connection) {
            await connection.end();
            console.log('데이터베이스 연결 종료');
        }
    }
}

// 스크립트 실행
initDocuments();