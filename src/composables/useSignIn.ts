import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { User } from '@/models/User'

export function useAuth() {
    const router = useRouter()
    const loading = ref(false)
    const errorMessage = ref<string | null>(null)

    const login = async (email: string, password: string) => {
        if (loading.value) return
        loading.value = true
        errorMessage.value = null

        try {
            // cari user berdasarkan email
            const result = await User.query()
                .where('email', email)
                .first()

            const data = result.data

            if (!data) {
                throw new Error('Email tidak ditemukan')
            }

            // cek password
            if (data.password !== password) {
                throw new Error('Password salah')
            }

            // simpan ke localStorage (session sederhana)
            localStorage.setItem('user', JSON.stringify(data))

            // redirect ke dashboard
            await router.push({ name: 'Dashboard' })

        } catch (err: any) {
            errorMessage.value =
                err?.message || 'Terjadi kesalahan saat login.'
        } finally {
            loading.value = false
        }
    }

    return {
        login,
        loading,
        errorMessage
    }
}