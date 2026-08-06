import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
    return NextResponse.next({
        request: {
            headers: request.headers,
        },
    });
}

export const config = {
    matcher: ['/admin/:path*'],
};
