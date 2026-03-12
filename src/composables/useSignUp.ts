import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { User } from '@/models/User'

export function useAuth() {
    const router = useRouter()
    const loading = ref(false)
    const errorMessage = ref<string | null>(null)

    const register = async (name: string, email: string, password: string) => {
        if (loading.value) return
        loading.value = true
        errorMessage.value = null

        try {

            // buat instance model
            const user = new User({
                name,
                email,
                password,
            })

            // simpan ke database
            const result = await user.save()

            if (!result.success) {
                throw result.error
            }

            console.log(result)

            // redirect
            await router.push({ name: 'dashboard' })

        } catch (err: any) {
            errorMessage.value =
                err?.message || 'Terjadi kesalahan saat register.'
        } finally {
            loading.value = false
        }
    }

    return {
        register,
        loading,
        errorMessage
    }
}