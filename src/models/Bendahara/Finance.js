import { SuperEloquent } from '@/services/orm'
import { FinanceTransaction } from './FinanceTransaction'

export class Finance extends SuperEloquent {

    static table = 'finances'

    static fields = [
        'id',
        'transaction_date',
        'description',
        'type',
        'amount',
        'category_id',
        'created_at'
    ]

    /* ==============================
       RELATIONS
    ============================== */

    async transactions() {
        return this.hasMany(FinanceTransaction, 'finance_id')
    }

}