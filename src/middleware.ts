import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
    const adminSession = request.cookies.get('admin_session');
    
    const isLoginPage = request.nextUrl.pathname === '/admin/login';
    const isAdminRoute = request.nextUrl.pathname.startsWith('/admin');

    if (isAdminRoute && !isLoginPage) {
        if (!adminSession) {
            return NextResponse.redirect(new URL('/admin/login', request.url));
        }
        // In a real app, you would verify the session ID/token here
    }

    if (isLoginPage && adminSession) {
        return NextResponse.redirect(new URL('/admin', request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/admin/:path*'],
};

