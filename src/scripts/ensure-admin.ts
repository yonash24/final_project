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
    const email = 'yonashay87@gmail.com';
    const password = '123456';

    console.log(`Ensuring admin user: ${email}...`);

    // 1. Check if user exists
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) {
        console.error('Error listing users:', listError.message);
        return;
    }

    const existingUser = users.find(u => u.email === email);

    let userId: string;

    if (existingUser) {
        console.log('User already exists in Auth. Updating password...');
        const { data: updatedUser, error: updateError } = await supabase.auth.admin.updateUserById(
            existingUser.id,
            { password, email_confirm: true }
        );
        if (updateError) {
            console.error('Error updating user:', updateError.message);
            return;
        }
        userId = updatedUser.user.id;
        console.log('Password updated successfully.');
    } else {
        console.log('Creating new user in Auth...');
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
