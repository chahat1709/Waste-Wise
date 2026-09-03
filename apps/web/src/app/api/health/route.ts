export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({
    ok: true,
    service: "waste-wise-web",
    stage: "foundation-preview",
    timestamp: new Date().toISOString(),
    dependencies: {
      supabaseConfigured: Boolean(
        process.env.NEXT_PUBLIC_SUPABASE_URL &&
          process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      ),
    },
  });
}
