import { supabase } from '@/lib/supabase'
import { User } from '@/models/User'

export async function signup({ name, email, password }) {
    const { data, error } = await supabase.auth.signUp({
        email,
        password
    })

    if (error) throw error
    if (!data.user) throw new Error('User gagal dibuat')

    const user = new User({
        id: data.user.id,
        name,
        email
    })

    const result = await user.save()
    if (!result.success) throw result.error

    return result
}