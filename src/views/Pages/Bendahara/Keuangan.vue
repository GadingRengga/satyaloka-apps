<template>

    <AdminLayout>

        <PageBreadcrumb :pageTitle="currentPageTitle" />

        <div class="space-y-6">

            <!-- SUMMARY -->

            <div class="grid grid-cols-3 gap-6">

                <div class="p-5 bg-green-50 border rounded-xl">
                    <p class="text-sm">Total Pemasukan</p>
                    <h2 class="text-2xl font-bold text-green-600">
                        Rp {{ formatMoney(totalIncome) }}
                    </h2>
                </div>

                <div class="p-5 bg-red-50 border rounded-xl">
                    <p class="text-sm">Total Pengeluaran</p>
                    <h2 class="text-2xl font-bold text-red-600">
                        Rp {{ formatMoney(totalExpense) }}
                    </h2>
                </div>

                <div class="p-5 bg-blue-50 border rounded-xl">
                    <p class="text-sm">Saldo</p>
                    <h2 class="text-2xl font-bold text-blue-600">
                        Rp {{ formatMoney(balance) }}
                    </h2>
                </div>

            </div>


            <!-- TABLE -->

            <div class="border rounded-xl bg-white p-6">

                <div class="flex justify-between mb-4">

                    <h3 class="font-semibold text-lg">Riwayat Transaksi</h3>

                    <button @click="openCreate" class="px-4 py-2 bg-blue-600 text-white rounded">
                        + Tambah
                    </button>

                </div>

                <table class="w-full">

                    <thead>

                        <tr class="border-b text-left">
                            <th class="py-2">Tanggal</th>
                            <th>Keterangan</th>
                            <th>Pemasukan</th>
                            <th>Pengeluaran</th>
                            <th>Saldo</th>
                            <th>Aksi</th>
                        </tr>

                    </thead>

                    <tbody>

                        <tr v-for="(item, index) in finances" :key="item.id" class="border-b">

                            <td class="py-2">
                                {{ formatDate(item.transaction_date) }}
                            </td>

                            <td>
                                {{ item.description }}
                            </td>

                            <td class="text-green-600">
                                Rp {{ formatMoney(sumIncome(item)) }}
                            </td>

                            <td class="text-red-600">
                                Rp {{ formatMoney(sumExpense(item)) }}
                            </td>

                            <td>
                                Rp {{ formatMoney(calculateBalance(index)) }}
                            </td>

                            <td class="space-x-2">

                                <button @click="openEdit(item)" class="text-blue-600">
                                    Edit
                                </button>

                                <button @click="deleteFinance(item, index)" class="text-red-600">
                                    Delete
                                </button>

                            </td>

                        </tr>

                    </tbody>

                </table>

            </div>

        </div>


        <!-- MODAL -->

        <Teleport to="body">

            <div v-if="showModal" class="fixed inset-0 flex items-center justify-center bg-black/40">

                <div class="bg-white w-[700px] rounded-xl p-6 space-y-4">

                    <h3 class="text-lg font-semibold">
                        {{ isEdit ? 'Edit' : 'Tambah' }} Transaksi
                    </h3>


                    <input type="date" v-model="form.transaction_date" class="border p-2 rounded w-full" />


                    <input type="text" v-model="form.description" placeholder="Keterangan"
                        class="border p-2 rounded w-full" />


                    <!-- REPEATER -->

                    <table class="w-full border">

                        <thead>

                            <tr class="bg-gray-100">

                                <th class="p-2">Keterangan</th>
                                <th class="p-2">Type</th>
                                <th class="p-2">Nominal</th>
                                <th></th>

                            </tr>

                        </thead>

                        <tbody>

                            <tr v-for="(trx, i) in form.transactions" :key="i">

                                <td class="p-1">

                                    <input v-model="trx.description" class="border p-1 w-full" />

                                </td>

                                <td class="p-1">

                                    <select v-model="trx.type" class="border p-1 w-full">

                                        <option :value="1">Pemasukan</option>
                                        <option :value="2">Pengeluaran</option>

                                    </select>

                                </td>

                                <td class="p-1">

                                    <input :value="formatMoney(trx.amount)" @input="handleAmountInput($event, trx)"
                                        class="border p-1 w-full" />

                                </td>

                                <td class="text-center">

                                    <button @click="removeTransaction(i)" class="text-red-500">
                                        x
                                    </button>

                                </td>

                            </tr>

                        </tbody>

                    </table>

                    <button @click="addTransaction" class="text-blue-600 text-sm">
                        + Tambah Baris
                    </button>


                    <div class="flex justify-end gap-2 pt-4">

                        <button @click="closeModal" class="border px-4 py-2 rounded">
                            Batal
                        </button>

                        <button @click="saveFinance" class="bg-blue-600 text-white px-4 py-2 rounded">
                            Simpan
                        </button>

                    </div>

                </div>

            </div>

        </Teleport>

    </AdminLayout>

</template>


<script setup>

import { ref, computed, onMounted } from 'vue'

import AdminLayout from '@/components/layout/AdminLayout.vue'
import PageBreadcrumb from '@/components/common/PageBreadcrumb.vue'

import { Finance } from '@/models/Bendahara/Finance'
import { FinanceTransaction } from '@/models/Bendahara/FinanceTransaction'


const currentPageTitle = ref('Keuangan')

const finances = ref([])

const showModal = ref(false)
const isEdit = ref(false)

const currentEdit = ref(null)


const form = ref({
    transaction_date: '',
    description: '',
    transactions: []
})


function formatMoney(v) {

    return Number(v || 0).toLocaleString('id-ID')

}


function parseMoney(v) {

    return Number(String(v).replace(/\D/g, '')) || 0

}


function handleAmountInput(e, obj) {

    const raw = parseMoney(e.target.value)

    obj.amount = raw

    e.target.value = formatMoney(raw)

}


function addTransaction() {

    form.value.transactions.push({
        description: '',
        type: 1,
        amount: 0
    })

}


function removeTransaction(i) {

    form.value.transactions.splice(i, 1)

    if (form.value.transactions.length === 0) {
        addTransaction()
    }

}


async function loadFinances() {

    const result = await Finance
        .orderBy('transaction_date', 'asc')
        .get()

    if (!result.success) return


    for (const f of result.data) {

        f.transactions = await f.transactions()

    }

    finances.value = result.data

}

onMounted(loadFinances)


function sumIncome(item) {

    return item.transactions
        .filter(t => t.type == 1)
        .reduce((a, b) => a + Number(b.amount || 0), 0)

}


function sumExpense(item) {

    return item.transactions
        .filter(t => t.type == 2)
        .reduce((a, b) => a + Number(b.amount || 0), 0)

}


const totalIncome = computed(() => {

    return finances.value.reduce((a, b) => a + sumIncome(b), 0)

})


const totalExpense = computed(() => {

    return finances.value.reduce((a, b) => a + sumExpense(b), 0)

})


const balance = computed(() => {

    return totalIncome.value - totalExpense.value

})


function calculateBalance(index) {

    let saldo = 0

    for (let i = 0; i <= index; i++) {

        saldo += sumIncome(finances.value[i])
        saldo -= sumExpense(finances.value[i])

    }

    return saldo

}


function openCreate() {

    isEdit.value = false

    form.value = {
        transaction_date: new Date().toISOString().slice(0, 10),
        description: '',
        transactions: []
    }

    addTransaction()

    showModal.value = true

}


function openEdit(item) {

    isEdit.value = true

    currentEdit.value = item

    form.value = {
        transaction_date: item.transaction_date,
        description: item.description,
        transactions: item.transactions.map(t => ({
            description: t.description,
            type: t.type,
            amount: t.amount
        }))
    }

    showModal.value = true

}


function closeModal() {
    showModal.value = false
}


async function saveFinance() {

    let finance

    if (isEdit.value) {

        finance = currentEdit.value

        finance.transaction_date = form.value.transaction_date
        finance.description = form.value.description

        await finance.save()

    } else {

        finance = new Finance({
            transaction_date: form.value.transaction_date,
            description: form.value.description
        })

        await finance.save()

    }


    await FinanceTransaction
        .where('finance_id', finance.id)
        .delete()


    for (const trx of form.value.transactions) {

        const t = new FinanceTransaction({

            finance_id: finance.id,
            description: trx.description,
            type: trx.type,
            amount: trx.amount

        })

        await t.save()

    }


    closeModal()

    await loadFinances()

}


async function deleteFinance(item, index) {

    if (!confirm('hapus transaksi ini?')) return

    await item.delete()

    finances.value.splice(index, 1)

}


function formatDate(d) {

    return new Date(d).toLocaleDateString('id-ID')

}

</script>