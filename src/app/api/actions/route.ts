import { NextResponse } from 'next/server';
import { limitUserAction } from '@/lib/server/rate-limit';
import { actionSchema } from '@/schemas/actions';
import { assertSameOrigin, failure, requireUser, readJSONBody } from '@/lib/server/http';
import { performAction } from '@/lib/server/actions';
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { db, user } = await requireUser();
    limitUserAction(user.id, 'mutation');
    const action = actionSchema.parse(await readJSONBody(request));
    const data = await performAction(
      db,
      user,
      action,
      process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin,
    );
    return NextResponse.json({ data });
  } catch (error) {
    return failure(error);
  }
}
