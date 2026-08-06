import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
});

async function main() {
    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;

    if (!email || !password) {
        console.error('Missing ADMIN_EMAIL or ADMIN_PASSWORD environment variables');
        process.exit(1);
    }

    console.log(`Ensuring admin user: ${email}...`);
    const { data: existingAdmin, error: adminLookupError } = await supabase
        .from('admin_users')
        .select('id, email, role')
        .eq('email', email)
        .maybeSingle();

    if (adminLookupError) {
        console.error('Error looking up admin profile:', adminLookupError.message);
        return;
    }

    let userId: string | null = existingAdmin?.id ?? null;

    if (userId) {
        console.log('Admin profile already exists. Updating password in Auth...');
        const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
            password,
            email_confirm: true,
        });

        if (updateError) {
            console.error('Error updating user password:', updateError.message);
            return;
        }

        console.log('Password updated successfully.');
    } else {
        console.log('Creating user in Auth...');
        const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
        });

        if (createError) {
            console.error('Error creating user:', createError.message);
            return;
        }

        userId = newUser.user.id;
        console.log('User created successfully.');
    }

    // 2. Ensure user is in admin_users table
    console.log('Ensuring user is in public.admin_users table...');
    const { error: dbError } = await supabase
        .from('admin_users')
        .upsert({
            id: userId,
            email: email,
            role: 'super_admin',
        }, { onConflict: 'id' });

    if (dbError) {
        console.error('Error updating admin_users table:', dbError.message);
        return;
    }

    console.log('✅ Admin access granted successfully!');
}

main();
