import type { Server } from 'node:http';
import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { applyCors, corsOptionsFromEnv } from '../src/common/http/cors';
import { PrismaService } from '../src/prisma/prisma.service';
import { initAppOnLoopback } from './util/listen-loopback';

/**
 * CORS allowlist (`CORS_ORIGINS`): the app is built through the SAME `applyCors`
 * that `main.ts` calls, so this proves the runtime configuration — an allowed
 * origin gets the CORS headers, any other origin gets none, and an empty list
 * leaves CORS off. No DB: PrismaService is a no-op.
 */
const ALLOWED = 'http://allowed.test';
const EVIL = 'http://evil.test';

async function buildApp(corsOrigins: string): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PrismaService)
    .useValue({ onModuleInit: async () => {}, onModuleDestroy: async () => {} })
    .compile();
  const app = moduleRef.createNestApplication();
  applyCors(app, corsOrigins);
  await initAppOnLoopback(app);
  return app;
}

function preflight(app: INestApplication, origin: string) {
  return request(app.getHttpServer() as Server)
    .options('/auth/login')
    .set('Origin', origin)
    .set('Access-Control-Request-Method', 'POST')
    .set('Access-Control-Request-Headers', 'authorization,content-type');
}

describe('CORS (e2e)', () => {
  describe('with CORS_ORIGINS listing one origin', () => {
    let app: INestApplication;

    beforeAll(async () => {
      app = await buildApp(ALLOWED);
    });

    afterAll(async () => {
      await app.close();
    });

    it('preflight from the allowed origin is answered with that origin and the auth headers', async () => {
      const res = await preflight(app, ALLOWED);
      expect(res.status).toBe(204);
      expect(res.headers['access-control-allow-origin']).toBe(ALLOWED);
      expect(
        res.headers['access-control-allow-headers'].toLowerCase(),
      ).toContain('authorization');
      expect(
        res.headers['access-control-allow-headers'].toLowerCase(),
      ).toContain('content-type');
      expect(res.headers['access-control-allow-methods']).toContain('POST');
      expect(res.headers['access-control-allow-credentials']).toBeUndefined();
    });

    it('preflight from any other origin gets no allow-origin header', async () => {
      const res = await preflight(app, EVIL);
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('an actual request from the allowed origin carries the allow-origin header, even on an error', async () => {
      // Empty body ⇒ 400 from the ValidationPipe: the client must still be allowed to read the envelope.
      const res = await request(app.getHttpServer() as Server)
        .post('/auth/login')
        .set('Origin', ALLOWED)
        .send({});
      expect(res.status).toBe(400);
      expect(res.headers['access-control-allow-origin']).toBe(ALLOWED);
    });

    it('an actual request from the allowed origin exposes Content-Disposition (PDF file name)', async () => {
      const res = await request(app.getHttpServer() as Server)
        .post('/auth/login')
        .set('Origin', ALLOWED)
        .send({});
      expect(res.headers['access-control-expose-headers']).toContain(
        'Content-Disposition',
      );
    });

    it('a request from any other origin still gets no allow-origin header', async () => {
      // The `cors` middleware writes the expose list on every response; without an
      // allow-origin the browser refuses the response anyway, so nothing is readable there.
      const res = await request(app.getHttpServer() as Server)
        .post('/auth/login')
        .set('Origin', EVIL)
        .send({});
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  describe('with CORS_ORIGINS empty', () => {
    let app: INestApplication;

    beforeAll(async () => {
      app = await buildApp('');
    });

    afterAll(async () => {
      await app.close();
    });

    it('sends no CORS header at all', async () => {
      const res = await preflight(app, ALLOWED);
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
      expect(res.headers['access-control-allow-headers']).toBeUndefined();
      expect(res.headers['access-control-allow-methods']).toBeUndefined();
    });
  });
});

describe('corsOptionsFromEnv', () => {
  it.each([undefined, '', ' , ', ',,'])('%p ⇒ null (CORS off)', (raw) => {
    expect(corsOptionsFromEnv(raw)).toBeNull();
  });

  it('trims, drops blanks and de-duplicates, keeping exact origins', () => {
    expect(corsOptionsFromEnv('a, b,a')?.origin).toEqual(['a', 'b']);
    expect(corsOptionsFromEnv(' https://app.example.vn ,')?.origin).toEqual([
      'https://app.example.vn',
    ]);
  });

  it('allows only the methods and headers the clients use, without credentials', () => {
    expect(corsOptionsFromEnv('https://app.example.vn')).toEqual({
      origin: ['https://app.example.vn'],
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
      allowedHeaders: ['Authorization', 'Content-Type'],
      exposedHeaders: ['Content-Disposition'],
      credentials: false,
      maxAge: 600,
    });
  });
});
