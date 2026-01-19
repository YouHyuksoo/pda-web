/**
 * @file src/lib/db/oracle.ts
 * @description
 * Oracle 데이터베이스 연결 클래스입니다.
 * C# clsDB_Oracle.cs를 TypeScript로 변환한 것입니다.
 *
 * 초보자 가이드:
 * 1. **getConnection()**: DB 연결 풀에서 연결 획득
 * 2. **execute()**: INSERT/UPDATE/DELETE 실행
 * 3. **query()**: SELECT 쿼리 실행 및 결과 반환
 * 4. **executeProc()**: 저장 프로시저 실행
 *
 * @example
 * const result = await oracle.query<UserType>('SELECT * FROM USERS WHERE USER_ID = :id', { id: 'user1' });
 */

import oracledb, { BindParameters } from 'oracledb';

// Oracle Thick 모드 초기화 (Oracle Instant Client 필요)
// Windows에서는 Oracle Instant Client 경로 설정 필요
try {
  // Oracle Instant Client 경로 (필요시 환경에 맞게 수정)
  // oracledb.initOracleClient({ libDir: 'C:\\oracle\\instantclient_21_3' });
} catch {
  console.warn('Oracle Instant Client 초기화 생략 (Thin 모드 사용)');
}

/**
 * Oracle 연결 설정 인터페이스
 */
interface OracleConfig {
  user: string;
  password: string;
  connectString: string;
}

/**
 * 쿼리 실행 결과 인터페이스
 */
interface QueryResult<T> {
  success: boolean;
  data?: T[];
  rowsAffected?: number;
  error?: string;
}

/**
 * 프로시저 실행 결과 인터페이스
 */
interface ProcResult<T> {
  success: boolean;
  rsCode?: string;
  rsMsg?: string;
  data?: T[];
  error?: string;
}

/**
 * Oracle 데이터베이스 클래스
 * Singleton 패턴으로 구현
 */
class OracleDB {
  private static instance: OracleDB;
  private pool: oracledb.Pool | null = null;
  private config: OracleConfig;
  private maxRetries = 3;
  private retryDelay = 3000; // 3초

  private constructor() {
    // 환경변수에서 연결 정보 로드
    const host = process.env.ORACLE_HOST || '10.1.45.4';
    const port = process.env.ORACLE_PORT || '1521';
    const sid = process.env.ORACLE_SID || 'HSMESDB';

    this.config = {
      user: process.env.ORACLE_USER || 'hsgmes',
      password: process.env.ORACLE_PASSWORD || 'hsgmes',
      connectString: `${host}:${port}/${sid}`,
    };
  }

  /**
   * 싱글톤 인스턴스 반환
   */
  public static getInstance(): OracleDB {
    if (!OracleDB.instance) {
      OracleDB.instance = new OracleDB();
    }
    return OracleDB.instance;
  }

  /**
   * 연결 풀 초기화
   */
  private async initPool(): Promise<void> {
    if (this.pool) return;

    try {
      this.pool = await oracledb.createPool({
        user: this.config.user,
        password: this.config.password,
        connectString: this.config.connectString,
        poolMin: 2,
        poolMax: 10,
        poolIncrement: 1,
        poolTimeout: 60,
      });
      console.log('Oracle 연결 풀 생성 완료');
    } catch (err) {
      console.error('Oracle 연결 풀 생성 실패:', err);
      throw err;
    }
  }

  /**
   * DB 연결 획득 (재시도 로직 포함)
   * C# OpenConnection() + ReConnection() 대체
   */
  public async getConnection(): Promise<oracledb.Connection> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        await this.initPool();
        if (!this.pool) throw new Error('연결 풀이 없습니다');

        const connection = await this.pool.getConnection();
        return connection;
      } catch (err) {
        lastError = err as Error;
        console.error(`Oracle 연결 시도 ${attempt}/${this.maxRetries} 실패:`, err);

        if (attempt < this.maxRetries) {
          await this.sleep(this.retryDelay);
        }
      }
    }

    throw lastError || new Error('Oracle 연결 실패');
  }

  /**
   * 연결 해제
   * C# CloseConnection() 대체
   */
  public async releaseConnection(connection: oracledb.Connection): Promise<void> {
    try {
      await connection.close();
    } catch (err) {
      console.error('연결 해제 실패:', err);
    }
  }

  /**
   * SELECT 쿼리 실행
   * C# gCreateRSet() 대체
   *
   * @param sql SQL 쿼리문
   * @param params 바인드 파라미터
   * @returns 쿼리 결과
   */
  public async query<T = Record<string, unknown>>(
    sql: string,
    params: BindParameters = {}
  ): Promise<QueryResult<T>> {
    let connection: oracledb.Connection | null = null;

    try {
      connection = await this.getConnection();

      const result = await connection.execute(sql, params, {
        outFormat: oracledb.OUT_FORMAT_OBJECT,
        autoCommit: true,
      });

      return {
        success: true,
        data: result.rows as T[],
      };
    } catch (err) {
      const error = err as Error;
      console.error('쿼리 실행 실패:', error);
      return {
        success: false,
        error: error.message,
      };
    } finally {
      if (connection) {
        await this.releaseConnection(connection);
      }
    }
  }

  /**
   * INSERT/UPDATE/DELETE 실행
   * C# ExecuteSql() 대체
   *
   * @param sql SQL 문
   * @param params 바인드 파라미터
   * @returns 실행 결과
   */
  public async execute(
    sql: string,
    params: BindParameters = {}
  ): Promise<QueryResult<never>> {
    let connection: oracledb.Connection | null = null;

    try {
      connection = await this.getConnection();

      const result = await connection.execute(sql, params, {
        autoCommit: true,
      });

      return {
        success: true,
        rowsAffected: result.rowsAffected,
      };
    } catch (err) {
      const error = err as Error;
      console.error('SQL 실행 실패:', error);
      return {
        success: false,
        error: error.message,
      };
    } finally {
      if (connection) {
        await this.releaseConnection(connection);
      }
    }
  }

  /**
   * 트랜잭션 내 다중 SQL 실행
   *
   * @param queries SQL 문 배열
   * @returns 실행 결과
   */
  public async executeTransaction(
    queries: { sql: string; params?: BindParameters }[]
  ): Promise<QueryResult<never>> {
    let connection: oracledb.Connection | null = null;

    try {
      connection = await this.getConnection();

      for (const query of queries) {
        await connection.execute(query.sql, query.params || {});
      }

      await connection.commit();
      return { success: true };
    } catch (err) {
      const error = err as Error;
      console.error('트랜잭션 실행 실패:', error);

      if (connection) {
        await connection.rollback();
      }

      return {
        success: false,
        error: error.message,
      };
    } finally {
      if (connection) {
        await this.releaseConnection(connection);
      }
    }
  }

  /**
   * 저장 프로시저 실행
   * C# gProcCreateRSet() 대체
   *
   * @param procName 프로시저명
   * @param params 입력 파라미터
   * @returns 프로시저 실행 결과
   */
  public async executeProc<T = Record<string, unknown>>(
    procName: string,
    params: Record<string, oracledb.BindParameter['val']> = {}
  ): Promise<ProcResult<T>> {
    let connection: oracledb.Connection | null = null;

    try {
      connection = await this.getConnection();

      // OUT 파라미터 추가 (RS_CODE, RS_MSG, 커서)
      const bindParams: Record<string, oracledb.BindParameter> = {};

      // 입력 파라미터 설정
      for (const [key, value] of Object.entries(params)) {
        bindParams[key] = { dir: oracledb.BIND_IN, val: value };
      }

      // 출력 파라미터 설정
      bindParams['RS_CODE'] = { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 10 };
      bindParams['RS_MSG'] = { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 500 };
      bindParams['RS_CURSOR'] = { dir: oracledb.BIND_OUT, type: oracledb.CURSOR };

      // 프로시저 호출 SQL 생성
      const paramList = Object.keys(bindParams).map(k => `:${k}`).join(', ');
      const sql = `BEGIN ${procName}(${paramList}); END;`;

      const result = await connection.execute(sql, bindParams);
      const outBinds = result.outBinds as Record<string, unknown>;

      // 커서에서 데이터 추출
      let data: T[] = [];
      const cursor = outBinds['RS_CURSOR'] as oracledb.ResultSet<T>;
      if (cursor) {
        data = await cursor.getRows() as T[];
        await cursor.close();
      }

      return {
        success: outBinds['RS_CODE'] === '00',
        rsCode: outBinds['RS_CODE'] as string,
        rsMsg: outBinds['RS_MSG'] as string,
        data,
      };
    } catch (err) {
      const error = err as Error;
      console.error('프로시저 실행 실패:', error);
      return {
        success: false,
        error: error.message,
      };
    } finally {
      if (connection) {
        await this.releaseConnection(connection);
      }
    }
  }

  /**
   * 단일 값 조회
   * C# GetScalar() 대체
   *
   * @param sql SQL 쿼리문
   * @param params 바인드 파라미터
   * @returns 단일 값
   */
  public async scalar<T = string>(
    sql: string,
    params: BindParameters = {}
  ): Promise<T | null> {
    const result = await this.query<Record<string, T>>(sql, params);

    if (result.success && result.data && result.data.length > 0) {
      const firstRow = result.data[0];
      const firstKey = Object.keys(firstRow)[0];
      return firstRow[firstKey];
    }

    return null;
  }

  /**
   * 연결 풀 종료
   */
  public async closePool(): Promise<void> {
    if (this.pool) {
      try {
        await this.pool.close(10);
        this.pool = null;
        console.log('Oracle 연결 풀 종료 완료');
      } catch (err) {
        console.error('연결 풀 종료 실패:', err);
      }
    }
  }

  /**
   * 대기 유틸리티
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 싱글톤 인스턴스 export
export const oracle = OracleDB.getInstance();

// 타입 export
export type { OracleConfig, QueryResult, ProcResult };
