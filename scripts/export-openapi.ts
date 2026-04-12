import 'reflect-metadata';
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from '../src/app.module';

async function main() {
  const outputPath = resolve(
    process.cwd(),
    process.argv[2] ?? 'tmp/openapi/orderfriends.openapi.json',
  );

  process.env.NODE_ENV ??= 'test';

  const app = await NestFactory.create(AppModule, {
    logger: false,
    rawBody: true,
  });

  const config = new DocumentBuilder()
    .setTitle('Order Friends API')
    .setDescription('Order Friends API schema export')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, JSON.stringify(document, null, 2), 'utf8');

  await app.close();
}

void main();
