import { SuperEloquent } from '@/services/orm'


export class FinanceTransaction extends SuperEloquent {

    static table = 'finance_transactions'

    static fields = [
        'id',
        'finance_id',
        'description',
        'type',
        'amount',
        'created_at'
    ]

    /* ==============================
       RELATIONS
    ============================== */

}