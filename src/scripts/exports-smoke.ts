import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { SupabaseService } from '../infra/supabase/supabase.service';

async function run(): Promise<void> {
  const exportSmokeUserId = process.env.EXPORT_SMOKE_USER_ID;
  if (!exportSmokeUserId) {
    console.error(
      'Missing EXPORT_SMOKE_USER_ID. Set it to a valid user UUID before running npm run exports:smoke.',
    );
    process.exitCode = 1;
    return;
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const supabaseService = app.get(SupabaseService);
    const sb = supabaseService.adminClient();

    const { data: inserted, error: insertError } = await sb
      .from('order_exports')
      .insert({
        user_id: exportSmokeUserId,
        status: 'PENDING',
      })
      .select('id, status')
      .single();

    if (insertError || !inserted) {
      throw new Error(insertError?.message ?? 'Insert failed');
    }

    const { data: found, error: findError } = await sb
      .from('order_exports')
      .select('id, status')
      .eq('id', inserted.id)
      .single();

    if (findError || !found) {
      throw new Error(findError?.message ?? 'Read-back failed');
    }

    console.log(JSON.stringify({ id: found.id, status: found.status }));

    const { error: cleanupError } = await sb
      .from('order_exports')
      .delete()
      .eq('id', inserted.id);

    if (cleanupError) {
      console.warn(`Cleanup warning: ${cleanupError.message}`);
    }
  } finally {
    await app.close();
  }
}

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`exports:smoke failed: ${message}`);
  process.exitCode = 1;
});
