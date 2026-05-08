import { createFileRoute } from '@tanstack/react-router'
import { createClient } from '@supabase/supabase-js'

const FROM = 'SmartVenda <onboarding@resend.dev>'

async function sendEmail(to: string, subject: string, html: string) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) throw new Error('RESEND_API_KEY not set')
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM, to: [to], subject, html }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    console.error('Resend error', res.status, data)
    return { ok: false, status: res.status, data }
  }
  return { ok: true, data }
}

export const Route = createFileRoute('/api/public/hooks/notify-alerts')({
  server: {
    handlers: {
      POST: async () => {
        const supabase = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
          { auth: { persistSession: false, autoRefreshToken: false } }
        )

        const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL
        const results: Record<string, unknown> = {}

        // 1) Expired / expiring subscriptions -> admin email
        if (adminEmail) {
          const nowIso = new Date().toISOString()
          const in3days = new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString()

          const { data: subs } = await supabase
            .from('user_subscriptions')
            .select('user_id, status, expires_at, plan_id, plans(name)')
            .lte('expires_at', in3days)
            .order('expires_at', { ascending: true })

          if (subs && subs.length) {
            // get profile emails
            const userIds = [...new Set(subs.map((s: any) => s.user_id))]
            const { data: profs } = await supabase
              .from('profiles')
              .select('id, email, full_name')
              .in('id', userIds)
            const pmap = new Map((profs ?? []).map((p: any) => [p.id, p]))

            const expired: any[] = []
            const expiring: any[] = []
            for (const s of subs as any[]) {
              const exp = s.expires_at ? new Date(s.expires_at) : null
              if (!exp) continue
              const row = {
                ...s,
                profile: pmap.get(s.user_id),
              }
              if (exp.toISOString() <= nowIso) expired.push(row)
              else expiring.push(row)
            }

            const renderRow = (r: any) =>
              `<tr><td style="padding:6px 10px;border-bottom:1px solid #eee">${r.profile?.full_name ?? '-'}</td>` +
              `<td style="padding:6px 10px;border-bottom:1px solid #eee">${r.profile?.email ?? '-'}</td>` +
              `<td style="padding:6px 10px;border-bottom:1px solid #eee">${r.plans?.name ?? '-'}</td>` +
              `<td style="padding:6px 10px;border-bottom:1px solid #eee">${new Date(r.expires_at).toLocaleString('pt-BR')}</td></tr>`

            const html = `
              <div style="font-family:Arial,sans-serif;max-width:680px;margin:auto">
                <h2>📋 Relatório SmartVenda — Assinaturas</h2>
                <h3 style="color:#b91c1c">Expiradas (${expired.length})</h3>
                ${expired.length ? `<table style="width:100%;border-collapse:collapse;font-size:14px"><thead><tr style="background:#f3f4f6"><th align="left" style="padding:6px 10px">Nome</th><th align="left" style="padding:6px 10px">Email</th><th align="left" style="padding:6px 10px">Plano</th><th align="left" style="padding:6px 10px">Expirou em</th></tr></thead><tbody>${expired.map(renderRow).join('')}</tbody></table>` : '<p>Nenhuma.</p>'}
                <h3 style="color:#b45309;margin-top:24px">Expirando em até 3 dias (${expiring.length})</h3>
                ${expiring.length ? `<table style="width:100%;border-collapse:collapse;font-size:14px"><thead><tr style="background:#f3f4f6"><th align="left" style="padding:6px 10px">Nome</th><th align="left" style="padding:6px 10px">Email</th><th align="left" style="padding:6px 10px">Plano</th><th align="left" style="padding:6px 10px">Expira em</th></tr></thead><tbody>${expiring.map(renderRow).join('')}</tbody></table>` : '<p>Nenhuma.</p>'}
                <p style="color:#6b7280;font-size:12px;margin-top:24px">Enviado automaticamente pelo SmartVenda</p>
              </div>`

            results.adminEmail = await sendEmail(
              adminEmail,
              `SmartVenda — ${expired.length} expiradas / ${expiring.length} expirando`,
              html
            )
          } else {
            results.adminEmail = { skipped: 'no subscriptions matched' }
          }
        }

        // 2) Low stock per owner -> store owner email
        const { data: lowProducts } = await supabase
          .from('products')
          .select('id, name, stock, min_stock, owner_id, unit')
          .eq('active', true)
          .gt('min_stock', 0)

        const byOwner = new Map<string, any[]>()
        for (const p of (lowProducts ?? []) as any[]) {
          if (Number(p.stock) <= Number(p.min_stock)) {
            const arr = byOwner.get(p.owner_id) ?? []
            arr.push(p)
            byOwner.set(p.owner_id, arr)
          }
        }

        const ownerEmails: any[] = []
        if (byOwner.size) {
          const { data: profs } = await supabase
            .from('profiles')
            .select('id, email, full_name, store_name')
            .in('id', [...byOwner.keys()])

          for (const prof of (profs ?? []) as any[]) {
            const items = byOwner.get(prof.id) ?? []
            if (!items.length || !prof.email) continue
            const rows = items
              .sort((a, b) => Number(a.stock) - Number(b.stock))
              .map(
                (p) =>
                  `<tr><td style="padding:6px 10px;border-bottom:1px solid #eee">${p.name}</td>` +
                  `<td style="padding:6px 10px;border-bottom:1px solid #eee;color:#b91c1c;font-weight:bold">${Number(p.stock)} ${p.unit}</td>` +
                  `<td style="padding:6px 10px;border-bottom:1px solid #eee">${Number(p.min_stock)} ${p.unit}</td></tr>`
              )
              .join('')
            const html = `
              <div style="font-family:Arial,sans-serif;max-width:680px;margin:auto">
                <h2>⚠️ Alerta de estoque baixo</h2>
                <p>Olá ${prof.full_name ?? ''}, os seguintes produtos da loja <b>${prof.store_name ?? ''}</b> estão com estoque abaixo do mínimo:</p>
                <table style="width:100%;border-collapse:collapse;font-size:14px">
                  <thead><tr style="background:#f3f4f6"><th align="left" style="padding:6px 10px">Produto</th><th align="left" style="padding:6px 10px">Estoque atual</th><th align="left" style="padding:6px 10px">Mínimo</th></tr></thead>
                  <tbody>${rows}</tbody>
                </table>
                <p style="color:#6b7280;font-size:12px;margin-top:24px">Reponha o estoque para evitar quebra de venda.<br/>SmartVenda</p>
              </div>`
            ownerEmails.push({
              owner: prof.email,
              count: items.length,
              result: await sendEmail(prof.email, `⚠️ ${items.length} produto(s) com estoque baixo`, html),
            })
          }
        }
        results.lowStock = ownerEmails

        // 3) Accounts payable due soon (next 5 days) -> store owner email
        const today = new Date(); today.setHours(0,0,0,0)
        const in5days = new Date(today.getTime() + 5 * 24 * 3600 * 1000)
        const { data: bills } = await supabase
          .from('accounts_payable')
          .select('id, owner_id, supplier, description, amount, due_date, status')
          .eq('status', 'pending')
          .lte('due_date', in5days.toISOString().slice(0, 10))
          .order('due_date', { ascending: true })

        const billsByOwner = new Map<string, any[]>()
        for (const b of (bills ?? []) as any[]) {
          const arr = billsByOwner.get(b.owner_id) ?? []
          arr.push(b); billsByOwner.set(b.owner_id, arr)
        }
        const billEmails: any[] = []
        if (billsByOwner.size) {
          const { data: profs } = await supabase
            .from('profiles')
            .select('id, email, full_name, store_name')
            .in('id', [...billsByOwner.keys()])
          for (const prof of (profs ?? []) as any[]) {
            const items = billsByOwner.get(prof.id) ?? []
            if (!items.length || !prof.email) continue
            const todayIso = today.toISOString().slice(0, 10)
            const rows = items.map((b) => {
              const overdue = b.due_date < todayIso
              const color = overdue ? '#b91c1c' : '#b45309'
              const label = overdue ? 'VENCIDA' : 'a vencer'
              return `<tr>
                <td style="padding:6px 10px;border-bottom:1px solid #eee">${b.description ?? '-'}</td>
                <td style="padding:6px 10px;border-bottom:1px solid #eee">${b.supplier ?? '-'}</td>
                <td style="padding:6px 10px;border-bottom:1px solid #eee;color:${color};font-weight:bold">${new Date(b.due_date).toLocaleDateString('pt-BR')} (${label})</td>
                <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right">R$ ${Number(b.amount).toFixed(2).replace('.', ',')}</td>
              </tr>`
            }).join('')
            const html = `
              <div style="font-family:Arial,sans-serif;max-width:680px;margin:auto">
                <h2>💸 Contas a pagar próximas do vencimento</h2>
                <p>Olá ${prof.full_name ?? ''}, sua loja <b>${prof.store_name ?? ''}</b> tem ${items.length} conta(s) a pagar nos próximos 5 dias (ou já vencidas):</p>
                <table style="width:100%;border-collapse:collapse;font-size:14px">
                  <thead><tr style="background:#f3f4f6">
                    <th align="left" style="padding:6px 10px">Descrição</th>
                    <th align="left" style="padding:6px 10px">Fornecedor</th>
                    <th align="left" style="padding:6px 10px">Vencimento</th>
                    <th align="right" style="padding:6px 10px">Valor</th>
                  </tr></thead>
                  <tbody>${rows}</tbody>
                </table>
                <p style="color:#6b7280;font-size:12px;margin-top:24px">SmartVenda — Financeiro</p>
              </div>`
            billEmails.push({
              owner: prof.email,
              count: items.length,
              result: await sendEmail(prof.email, `💸 ${items.length} conta(s) a pagar próximas do vencimento`, html),
            })
          }
        }
        results.billsDueSoon = billEmails

        return new Response(JSON.stringify({ ok: true, results }, null, 2), {
          headers: { 'Content-Type': 'application/json' },
        })
      },
      GET: async () => {
        // allow simple manual trigger via GET for testing
        return new Response('Use POST to trigger alerts', { status: 405 })
      },
    },
  },
})
