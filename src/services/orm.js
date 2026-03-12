import { supabase } from '@/lib/supabase'

const isDev =
    import.meta.env.MODE === 'development' ||
    window.location.hostname === 'localhost'

/* ============================================================
   ERROR CLASS
============================================================ */
class ORMError extends Error {
    constructor(message, code = 'UNKNOWN', details = null) {
        super(message)
        this.name = 'ORMError'
        this.code = code
        this.details = details
    }
}

/* ============================================================
   SUPER ELOQUENT CORE
============================================================ */
export class SuperEloquent {

    static table = ''
    static primaryKey = 'id'
    static dates = ['created_at', 'updated_at']
    static softDelete = false

    constructor(attributes = {}) {
        this.attributes = { ...attributes }
        this._castDates()

        return new Proxy(this, {
            get: (target, prop) => {
                if (prop in target) {
                    const value = target[prop]
                    return typeof value === 'function'
                        ? value.bind(target)
                        : value
                }
                return target.attributes[prop]
            },
            set: (target, prop, value) => {
                if (prop in target) target[prop] = value
                else target.attributes[prop] = value
                return true
            }
        })
    }

    /* ============================================================
       DATE CASTING
    ============================================================ */

    _castDates() {
        this.constructor.dates.forEach(field => {
            const value = this.attributes[field]
            if (value && typeof value === 'string') {
                this.attributes[field] = new Date(value)
            }
        })
    }

    static _serializeDates(payload) {
        Object.keys(payload).forEach(k => {
            if (payload[k] instanceof Date)
                payload[k] = payload[k].toISOString()
        })
    }

    /* ============================================================
       ERROR HANDLING
    ============================================================ */

    static _parseError(error) {

        if (!error)
            return new ORMError('Unknown database error')

        const pgErrors = {
            '23505': 'Duplicate data (data sudah ada).',
            '23503': 'Foreign key tidak valid.',
            '23502': 'Field wajib belum diisi.',
            'PGRST116': 'Data tidak ditemukan.'
        }

        const message =
            pgErrors[error.code] ||
            error.message ||
            'Terjadi kesalahan pada database.'

        return new ORMError(message, error.code, error.details)
    }

    static _logError(action, error, context = {}) {

        if (!isDev) return

        console.group(
            `%c[ORM ERROR] ${this.table} → ${action}`,
            'color:white;background:#e74c3c;padding:4px;border-radius:4px'
        )

        console.error(error)
        console.info('Context:', context)

        console.groupEnd()
    }

    /* ============================================================
       RELATIONS
    ============================================================ */

    async belongsTo(RelatedModel, foreignKey) {
        const id = this.attributes[foreignKey]
        if (!id) return null

        const result = await RelatedModel.find(id)
        return result.data
    }

    async hasMany(RelatedModel, foreignKey) {
        const id = this.attributes[this.constructor.primaryKey]
        if (!id) return []

        const result = await RelatedModel
            .where(foreignKey, id)
            .get()

        return result.data
    }

    /* ============================================================
       QUERY ENTRY
    ============================================================ */

    static query() { return new Builder(this) }
    static select(...args) { return this.query().select(...args) }
    static where(...args) { return this.query().where(...args) }
    static whereHas(...args) { return this.query().whereHas(...args) }
    static with(...args) { return this.query().with(...args) }
    static orderBy(...args) { return this.query().orderBy(...args) }
    static limit(...args) { return this.query().limit(...args) }
    static withTrashed() { return this.query().withTrashed() }
    static onlyTrashed() { return this.query().onlyTrashed() }

    static all() { return this.query().get() }

    static find(id) {
        return this.query()
            .where(this.primaryKey, id)
            .first()
    }

    /* ============================================================
       SAVE
    ============================================================ */

    async save() {

        const pk = this.constructor.primaryKey
        const id = this.attributes[pk]

        const payload = { ...this.attributes }
        delete payload[pk]

        this.constructor._serializeDates(payload)

        try {

            let query

            if (id) {
                query = supabase
                    .from(this.constructor.table)
                    .update(payload)
                    .eq(pk, id)
            } else {
                query = supabase
                    .from(this.constructor.table)
                    .insert(payload)
            }

            const { data, error } = await query
                .select()
                .single()

            if (error) throw error

            this.attributes = data
            this._castDates()

            return { success: true, data: this }

        } catch (err) {

            const parsed = this.constructor._parseError(err)

            this.constructor._logError(
                id ? 'UPDATE' : 'INSERT',
                parsed,
                payload
            )

            return { success: false, error: parsed }
        }
    }

    /* ============================================================
       DELETE
    ============================================================ */

    async delete() {

        const pk = this.constructor.primaryKey
        const id = this.attributes[pk]

        if (!id)
            return { success: false, error: 'Primary key tidak ada' }

        try {

            if (this.constructor.softDelete) {

                const { error } = await supabase
                    .from(this.constructor.table)
                    .update({ deleted_at: new Date().toISOString() })
                    .eq(pk, id)

                if (error) throw error

            } else {

                const { error } = await supabase
                    .from(this.constructor.table)
                    .delete()
                    .eq(pk, id)

                if (error) throw error
            }

            return { success: true }

        } catch (err) {

            const parsed = this.constructor._parseError(err)

            this.constructor._logError('DELETE', parsed, { id })

            return { success: false, error: parsed }
        }
    }

    async restore() {

        if (!this.constructor.softDelete)
            return { success: false }

        try {

            const { error } = await supabase
                .from(this.constructor.table)
                .update({ deleted_at: null })
                .eq(this.constructor.primaryKey, this.attributes.id)

            if (error) throw error

            return { success: true }

        } catch (err) {

            const parsed = this.constructor._parseError(err)

            this.constructor._logError('RESTORE', parsed)

            return { success: false, error: parsed }
        }
    }
}

/* ============================================================
   QUERY BUILDER
============================================================ */

class Builder {

    constructor(model) {
        this.model = model
        this._select = []
        this._relations = []
        this._filters = []
        this._orders = []
        this._limit = null
        this._withTrashed = false
        this._onlyTrashed = false
    }

    select(columns = '*') {

        if (columns !== '*') {
            if (Array.isArray(columns))
                this._select.push(...columns)
            else
                this._select.push(columns)
        }

        return this
    }

    with(relations) {

        if (Array.isArray(relations))
            this._relations.push(...relations)
        else
            this._relations.push(relations)

        return this
    }

    where(column, operator, value = null) {

        if (value === null) {
            value = operator
            operator = '='
        }

        const map = {
            '=': 'eq',
            '!=': 'neq',
            '>': 'gt',
            '<': 'lt',
            '>=': 'gte',
            '<=': 'lte',
            like: 'ilike',
            in: 'in'
        }

        this._filters.push({
            column,
            operator: map[operator] || 'eq',
            value
        })

        return this
    }

    whereHas(relation, column, operator, value = null) {

        if (value === null) {
            value = operator
            operator = '='
        }

        this._filters.push({
            column: `${relation}.${column}`,
            operator,
            value
        })

        return this
    }

    orderBy(column, direction = 'desc') {
        this._orders.push({ column, direction })
        return this
    }

    limit(n) {
        this._limit = n
        return this
    }

    withTrashed() {
        this._withTrashed = true
        return this
    }

    onlyTrashed() {
        this._onlyTrashed = true
        return this
    }

    _buildQuery() {

        let columns = '*'

        if (this._select.length)
            columns = this._select.join(',')

        if (this._relations.length) {

            const rel = this._relations
                .map(r => `${r}(*)`)
                .join(',')

            columns =
                columns === '*'
                    ? `*,${rel}`
                    : `${columns},${rel}`
        }

        let query = supabase
            .from(this.model.table)
            .select(columns)

        if (this.model.softDelete) {

            if (!this._withTrashed && !this._onlyTrashed)
                query = query.is('deleted_at', null)

            if (this._onlyTrashed)
                query = query.not('deleted_at', 'is', null)
        }

        this._filters.forEach(f => {
            query = query.filter(f.column, f.operator, f.value)
        })

        this._orders.forEach(o => {
            query = query.order(o.column, {
                ascending: o.direction === 'asc'
            })
        })

        if (this._limit)
            query = query.limit(this._limit)

        return query
    }

    async get() {

        try {

            const { data, error } = await this._buildQuery()

            if (error) throw error

            return {
                success: true,
                data: (data ?? []).map(d => new this.model(d))
            }

        } catch (err) {

            const parsed = this.model._parseError(err)

            this.model._logError('GET', parsed)

            return { success: false, error: parsed }
        }
    }

    async first() {

        try {

            const { data, error } =
                await this._buildQuery().maybeSingle()

            if (error) throw error

            return {
                success: true,
                data: data ? new this.model(data) : null
            }

        } catch (err) {

            const parsed = this.model._parseError(err)

            this.model._logError('FIRST', parsed)

            return { success: false, error: parsed }
        }
    }

    async paginate(page = 1, perPage = 10) {

        try {

            const from = (page - 1) * perPage
            const to = from + perPage - 1

            let query = this._buildQuery()

            query = query.range(from, to)

            const { data, count, error } =
                await query.select('*', { count: 'exact' })

            if (error) throw error

            return {
                success: true,
                data: (data ?? []).map(d => new this.model(d)),
                total: count ?? 0,
                currentPage: page,
                lastPage: Math.ceil((count ?? 0) / perPage)
            }

        } catch (err) {

            const parsed = this.model._parseError(err)

            this.model._logError('PAGINATE', parsed)

            return { success: false, error: parsed }
        }
    }
}