'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDownLeft, ArrowUpRight, Banknote, ChefHat, ChevronDown, CirclePlus, Clock3, Coffee,
  CreditCard, LayoutDashboard, Menu as MenuIcon, MoreHorizontal, Plus, ReceiptText,
  Search, Sparkles, Trash2, Utensils, Wallet, X,
} from 'lucide-react';
import { storeRequest, Expense, localDate, MenuItem, money, orderTotal, Report, Table } from '@/lib/store';

type Section = 'operacao' | 'cardapio' | 'financeiro';
const paymentLabels: Record<string, string> = { CASH: 'Dinheiro', CREDIT: 'Crédito', DEBIT: 'Débito', PIX: 'Pix' };

export default function Home() {
  const [section, setSection] = useState<Section>('operacao');
  const [tables, setTables] = useState<Table[]>([]);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [selectedTable, setSelectedTable] = useState<number | null>(null);
  const [menuFilter, setMenuFilter] = useState('');
  const [orderQuantity, setOrderQuantity] = useState(1);
  const [period, setPeriod] = useState(() => {
    const today = localDate(new Date());
    return { from: today, to: today };
  });
  const [report, setReport] = useState<Report | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [showTableForm, setShowTableForm] = useState(false);
  const [menuFormItem, setMenuFormItem] = useState<MenuItem | null | undefined>(undefined);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [paymentOrderId, setPaymentOrderId] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    const [nextTables, nextMenu] = await Promise.all([
      storeRequest<Table[]>('/tables'), storeRequest<MenuItem[]>('/menu-items?all=true'),
    ]);
    setTables(nextTables);
    setMenu(nextMenu);
    setSelectedTable((current) => current && nextTables.some((table) => table.id === current) ? current : nextTables[0]?.id ?? null);
  }, []);

  const loadReport = useCallback(async () => {
    const query = `from=${period.from}&to=${period.to}`;
    const [nextReport, nextExpenses] = await Promise.all([
      storeRequest<Report>(`/reports/financial?${query}`), storeRequest<Expense[]>(`/expenses?${query}`),
    ]);
    setReport(nextReport);
    setExpenses(nextExpenses);
  }, [period]);

  useEffect(() => {
    refresh().catch((error: Error) => setMessage(error.message));
  }, [refresh]);
  useEffect(() => {
    loadReport().catch((error: Error) => setMessage(error.message));
  }, [loadReport]);
  useEffect(() => {
    if (section === 'financeiro') loadReport().catch((error: Error) => setMessage(error.message));
  }, [section, loadReport]);

  const selected = tables.find((table) => table.id === selectedTable) ?? null;
  const categories = useMemo(() => [...new Set(menu.filter((item) => item.available).map((item) => item.category))], [menu]);
  const visibleMenu = menu.filter((item) => item.available && `${item.name} ${item.category}`.toLowerCase().includes(menuFilter.toLowerCase()));

  async function run(action: () => Promise<unknown>, success?: string): Promise<boolean> {
    setBusy(true); setMessage('');
    try { await action(); await refresh(); await loadReport(); if (success) setMessage(success); return true; }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Ocorreu um erro.'); return false; }
    finally { setBusy(false); }
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#" onClick={() => setSection('operacao')}>
          <span className="brand-mark"><Utensils size={20} strokeWidth={2.4} /></span>
          <span className="brand-copy"><strong>mesa clara</strong><small>GESTÃO DO RESTAURANTE</small></span>
        </a>
        <div className="side-label">ESPAÇO DE TRABALHO</div>
        <div className="workspace"><span className="workspace-icon">R</span><span><strong>Restaurante</strong><small>Unidade principal</small></span><ChevronDown size={15} /></div>
        <div className="side-label menu-label">MENU</div>
        <nav className="side-nav">
          <button className={section === 'operacao' ? 'nav-item active' : 'nav-item'} onClick={() => setSection('operacao')}><LayoutDashboard size={18} />Visão geral</button>
          <button className={section === 'cardapio' ? 'nav-item active' : 'nav-item'} onClick={() => setSection('cardapio')}><MenuIcon size={18} />Cardápio</button>
          <button className={section === 'financeiro' ? 'nav-item active' : 'nav-item'} onClick={() => setSection('financeiro')}><Wallet size={18} />Financeiro</button>
        </nav>
        <div className="sidebar-bottom"><div className="help-card"><Sparkles size={17} /><strong>Um serviço de cada vez</strong><p>Mesas organizadas deixam cada atendimento mais leve.</p></div><div className="profile"><div className="avatar">IC</div><span><strong>Equipe da casa</strong><small>Operação</small></span><MoreHorizontal size={18} /></div></div>
      </aside>

      <section className="main-area">
        <header className="topbar"><div className="breadcrumb"><span>Restaurante</span><span className="crumb-slash">/</span><strong>{section === 'operacao' ? 'Visão geral' : section === 'cardapio' ? 'Cardápio' : 'Financeiro'}</strong></div><div className="top-actions"><span className="open-status"><i />Operação aberta</span><span className="date-chip"><Clock3 size={15} />{new Date().toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })}</span></div></header>
        <div className="content">
          {message && <div className={message.startsWith('Pronto') ? 'notice success' : 'notice'} role="status">{message}<button onClick={() => setMessage('')} aria-label="Fechar aviso"><X size={15} /></button></div>}
          {section === 'operacao' && <section className="page-section">
            <div className="page-heading"><div><div className="eyebrow">{new Date().toLocaleDateString('pt-BR', { weekday: 'long' }).toUpperCase()} · SERVIÇO DA CASA</div><h1>Bom dia, equipe <span>☀️</span></h1><p>Veja o salão e acompanhe as comandas em andamento.</p></div><button className="button button-dark" onClick={() => setShowTableForm(true)}><CirclePlus size={17} />Adicionar mesa</button></div>
            <div className="stats-grid">
              <div className="stat-card"><span className="stat-icon lavender"><Utensils size={18} /></span><span className="stat-label">Mesas no salão</span><strong>{tables.length}</strong><small>{tables.filter((table) => table.order).length} ocupadas agora</small></div>
              <div className="stat-card"><span className="stat-icon mint"><ReceiptText size={18} /></span><span className="stat-label">Comandas abertas</span><strong>{tables.filter((table) => table.order).length}</strong><small>Em atendimento</small></div>
              <div className="stat-card"><span className="stat-icon peach"><Banknote size={18} /></span><span className="stat-label">Vendas de hoje</span><strong>{money(report?.revenue ?? '0')}</strong><small>Contas já fechadas</small></div>
              <div className="stat-card welcome-card"><span className="stat-icon cream"><ChefHat size={18} /></span><span className="stat-label">Cardápio disponível</span><strong>{menu.filter((item) => item.available).length} <small>itens</small></strong><button className="text-link" onClick={() => setSection('cardapio')}>Gerenciar cardápio <ArrowUpRight size={14} /></button></div>
            </div>
            <div className="operation-grid">
              <div className="panel tables-panel"><div className="panel-heading"><div><h2>Salão</h2><p>Selecione uma mesa para abrir ou continuar uma comanda.</p></div><span className="live-count"><i />{tables.length} mesas</span></div>
                <div className="table-grid">{tables.map((table) => <button key={table.id} onClick={() => setSelectedTable(table.id)} className={`table-card ${table.order ? 'occupied' : ''} ${selectedTable === table.id ? 'selected' : ''}`}><span className="table-top"><span className="table-dot" />Mesa {String(table.number).padStart(2, '0')}<span className="table-more" onClick={(event) => { event.stopPropagation(); if (window.confirm(`Remover a mesa ${table.number}?`)) run(() => storeRequest(`/tables/${table.id}`, { method: 'DELETE' })); }}><MoreHorizontal size={16} /></span></span><strong className="table-status">{table.order ? 'Em atendimento' : 'Livre'}</strong><span className="table-bottom"><span><Utensils size={13} />{table.capacity} lugares</span>{table.order && <b>{money(orderTotal(table.order))}</b>}</span></button>)}
                  {!tables.length && <div className="empty-state"><Utensils size={24} /><strong>O salão está vazio</strong><span>Adicione a primeira mesa para começar.</span></div>}
                </div>
                <div className="legend"><span><i className="legend-free" />Livre</span><span><i className="legend-busy" />Em atendimento</span><button onClick={() => setShowTableForm(true)}><Plus size={14} />Nova mesa</button></div>
              </div>
              <div className="panel order-panel"><div className="panel-heading order-heading"><div><div className="eyebrow">COMANDA ATUAL</div><h2>{selected ? `Mesa ${String(selected.number).padStart(2, '0')}` : 'Escolha uma mesa'}</h2></div>{selected?.order && <span className="order-badge">ABERTA</span>}</div>
                {!selected ? <div className="order-empty"><span className="empty-illustration"><Utensils size={23} /></span><strong>Selecione uma mesa</strong><p>A comanda e o cardápio aparecem aqui.</p></div> : <>
                  <div className="order-meta"><span><span className="table-dot" />{selected.order ? `Aberta às ${new Date(selected.order.openedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : 'Mesa livre'}</span><span><Utensils size={13} />{selected.capacity} lugares</span></div>
                  <div className="order-lines">{selected.order?.items.map((line) => <div className="order-line" key={line.id}><div className="line-copy"><strong>{line.nameSnapshot}</strong><small>{line.quantity} × {money(line.unitPrice)}</small></div><b>{money(Number(line.unitPrice) * line.quantity)}</b><button className="line-remove" aria-label="Remover item" onClick={() => run(() => storeRequest(`/orders/${selected.order!.id}/items/${line.id}`, { method: 'DELETE' }))}><X size={14} /></button></div>)}{!selected.order?.items.length && <div className="empty-order-copy">Nenhum item nesta comanda ainda.<br />Escolha algo gostoso no cardápio.</div>}</div>
                  <div className="add-items"><div className="add-items-title"><strong>Adicionar ao pedido</strong><label className="quantity-picker">Qtd.<input type="number" min="1" max="500" value={orderQuantity} onChange={(event) => setOrderQuantity(Math.max(1, Math.min(500, Number(event.target.value) || 1)))} /></label></div><div className="menu-search"><Search size={15} /><input value={menuFilter} onChange={(event) => setMenuFilter(event.target.value)} placeholder="Buscar no cardápio" /></div><div className="quick-menu">{visibleMenu.slice(0, 5).map((item) => <button className="quick-item" key={item.id} disabled={busy} onClick={() => run(() => storeRequest(`/tables/${selected.id}/items`, { method: 'POST', body: JSON.stringify({ menuItemId: item.id, quantity: orderQuantity }) }))}><span><strong>{item.name}</strong><small>{item.category}</small></span><b>{money(item.price)}</b><Plus size={15} /></button>)}{!visibleMenu.length && <small className="no-menu">Nenhum item disponível encontrado.</small>}</div></div>
                  <div className="order-total"><span>Total da comanda</span><strong>{money(orderTotal(selected.order))}</strong></div>
                  {selected.order && <button className="button button-dark checkout-button" disabled={busy} onClick={() => setPaymentOrderId(selected.order!.id)}><ReceiptText size={17} />Fechar conta <ArrowUpRight size={16} /></button>}
                </>}
              </div>
            </div>
          </section>}

          {section === 'cardapio' && <MenuSection menu={menu} busy={busy} onCreate={() => setMenuFormItem(null)} onEdit={(item) => setMenuFormItem(item)} onToggle={(item) => run(() => storeRequest(`/menu-items/${item.id}`, { method: 'PATCH', body: JSON.stringify({ available: !item.available }) }), 'Pronto, disponibilidade atualizada.')} onDelete={(item) => { if (window.confirm(`Remover “${item.name}” do cardápio?`)) run(() => storeRequest(`/menu-items/${item.id}`, { method: 'DELETE' }), 'Pronto, item removido.'); }} />}

          {section === 'financeiro' && <section className="page-section"><div className="page-heading"><div><div className="eyebrow">CONTROLE FINANCEIRO</div><h1>O dinheiro da casa</h1><p>Acompanhe vendas, despesas e saldo no período escolhido.</p></div><button className="button button-dark" onClick={() => setShowExpenseForm(true)}><CirclePlus size={17} />Registrar despesa</button></div>
            <div className="period-bar"><span><Clock3 size={15} />Período do relatório</span><label>De<input type="date" value={period.from} onChange={(event) => setPeriod((value) => ({ ...value, from: event.target.value }))} /></label><label>Até<input type="date" value={period.to} onChange={(event) => setPeriod((value) => ({ ...value, to: event.target.value }))} /></label><button className="button button-light" onClick={() => loadReport().catch((error: Error) => setMessage(error.message))}>Atualizar</button></div>
            <div className="finance-stats"><div className="finance-card revenue-card"><span className="finance-icon"><ArrowDownLeft size={18} /></span><small>Receita de vendas</small><strong>{money(report?.revenue ?? 0)}</strong><span>{report?.paidOrders ?? 0} contas fechadas no período</span></div><div className="finance-card expense-card"><span className="finance-icon"><ArrowUpRight size={18} /></span><small>Despesas registradas</small><strong>{money(report?.expenses ?? 0)}</strong><span>{report?.expenseCount ?? 0} lançamentos no período</span></div><div className="finance-card balance-card"><span className="finance-icon"><Wallet size={18} /></span><small>Saldo do período</small><strong>{money(report?.balance ?? 0)}</strong><span>Receita menos despesas</span></div></div>
            <div className="finance-columns"><div className="panel"><div className="panel-heading"><div><h2>Despesas</h2><p>Saídas registradas entre as datas escolhidas.</p></div><span className="count-pill">{expenses.length}</span></div>{expenses.length ? <div className="expense-list">{expenses.map((expense) => <div className="expense-row" key={expense.id}><span className="expense-symbol"><ArrowUpRight size={16} /></span><span className="expense-copy"><strong>{expense.description}</strong><small>{new Date(expense.incurredAt).toLocaleDateString('pt-BR')}</small></span><b>{money(expense.amount)}</b></div>)}</div> : <div className="empty-state compact"><Banknote size={22} /><strong>Nenhuma despesa no período</strong><span>Registre uma saída para acompanhar o saldo.</span></div>}</div>
              <div className="panel payment-panel"><div className="panel-heading"><div><h2>Vendas por pagamento</h2><p>Como os clientes pagaram as contas.</p></div></div><div className="payment-list">{Object.entries(paymentLabels).map(([method, label]) => <div className="payment-row" key={method}><span className={`payment-symbol ${method.toLowerCase()}`}>{method === 'CASH' ? <Banknote size={16} /> : method === 'PIX' ? <Sparkles size={16} /> : <CreditCard size={16} />}</span><span>{label}</span><strong>{money(report?.payments?.[method] ?? 0)}</strong></div>)}</div><div className="payment-total"><span>Total recebido</span><b>{money(report?.revenue ?? 0)}</b></div></div>
            </div>
          </section>}
        </div>
      </section>
      {showTableForm && <Modal title="Adicionar mesa" onClose={() => setShowTableForm(false)}><TableForm onCancel={() => setShowTableForm(false)} onSubmit={async (data) => { if (await run(() => storeRequest('/tables', { method: 'POST', body: JSON.stringify(data) }), 'Pronto, mesa adicionada.')) setShowTableForm(false); }} /></Modal>}
      {menuFormItem !== undefined && <Modal title={menuFormItem ? 'Editar item do cardápio' : 'Novo item do cardápio'} onClose={() => setMenuFormItem(undefined)}><MenuForm item={menuFormItem ?? null} onCancel={() => setMenuFormItem(undefined)} onSubmit={async (data) => { const ok = await run(() => menuFormItem ? storeRequest(`/menu-items/${menuFormItem.id}`, { method: 'PATCH', body: JSON.stringify(data) }) : storeRequest('/menu-items', { method: 'POST', body: JSON.stringify(data) }), menuFormItem ? 'Pronto, item atualizado.' : 'Pronto, item adicionado ao cardápio.'); if (ok) setMenuFormItem(undefined); }} /></Modal>}
      {showExpenseForm && <Modal title="Registrar despesa" onClose={() => setShowExpenseForm(false)}><ExpenseForm onCancel={() => setShowExpenseForm(false)} onSubmit={async (data) => { if (await run(() => storeRequest('/expenses', { method: 'POST', body: JSON.stringify(data) }), 'Pronto, despesa registrada.')) setShowExpenseForm(false); }} /></Modal>}
      {paymentOrderId !== null && <Modal title="Fechar conta" onClose={() => setPaymentOrderId(null)}><PaymentForm onCancel={() => setPaymentOrderId(null)} onSubmit={async (paymentMethod) => { if (await run(() => storeRequest(`/orders/${paymentOrderId}/close`, { method: 'POST', body: JSON.stringify({ paymentMethod }) }), 'Pronto, conta fechada e mesa liberada.')) setPaymentOrderId(null); }} /></Modal>}
    </main>
  );
}

function MenuSection({ menu, busy, onCreate, onEdit, onToggle, onDelete }: { menu: MenuItem[]; busy: boolean; onCreate: () => void; onEdit: (item: MenuItem) => void; onToggle: (item: MenuItem) => void; onDelete: (item: MenuItem) => void }) {
  const [filter, setFilter] = useState('');
  const filtered = menu.filter((item) => `${item.name} ${item.category}`.toLowerCase().includes(filter.toLowerCase()));
  return <section className="page-section"><div className="page-heading"><div><div className="eyebrow">SABORES DA CASA</div><h1>Cardápio</h1><p>Cuide dos itens que aparecem para a equipe lançar nas mesas.</p></div><button className="button button-dark" onClick={onCreate}><CirclePlus size={17} />Adicionar item</button></div><div className="panel menu-management"><div className="menu-toolbar"><div><h2>Itens cadastrados <span className="count-pill">{menu.length}</span></h2><p>Itens indisponíveis ficam ocultos na hora do pedido.</p></div><div className="menu-search management-search"><Search size={15} /><input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Buscar item" /></div></div><div className="menu-table-head"><span>ITEM</span><span>CATEGORIA</span><span>PREÇO</span><span>DISPONIBILIDADE</span><span /></div><div className="managed-menu-list">{filtered.map((item) => <div className="managed-menu-row" key={item.id}><button className="managed-name managed-name-button" onClick={() => onEdit(item)}><span className="food-icon"><Coffee size={17} /></span><span><strong>{item.name}</strong><small>{item.description || 'Sem descrição'}</small></span></button><span className="category-chip">{item.category}</span><button className="price-edit" onClick={() => onEdit(item)}>{money(item.price)}</button><button className={`availability ${item.available ? 'is-available' : ''}`} disabled={busy} onClick={() => onToggle(item)}><i />{item.available ? 'Disponível' : 'Pausado'}</button><button className="icon-button danger" aria-label={`Remover ${item.name}`} onClick={() => onDelete(item)}><Trash2 size={16} /></button></div>)}{!filtered.length && <div className="empty-state compact"><MenuIcon size={22} /><strong>Nenhum item encontrado</strong><span>Cadastre seu primeiro prato ou ajuste a busca.</span></div>}</div></div></section>;
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div className="modal-card" role="dialog" aria-modal="true" aria-label={title}><div className="modal-heading"><div><div className="eyebrow">MESA CLARA</div><h2>{title}</h2></div><button className="icon-button" onClick={onClose} aria-label="Fechar"><X size={18} /></button></div>{children}</div></div>;
}

function FormShell({ children, onSubmit, onCancel, submitLabel }: { children: React.ReactNode; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void; onCancel: () => void; submitLabel: string }) {
  return <form className="modal-form" onSubmit={onSubmit}>{children}<div className="form-actions"><button type="button" className="button button-light" onClick={onCancel}>Cancelar</button><button className="button button-dark" type="submit">{submitLabel}</button></div></form>;
}

function TableForm({ onSubmit, onCancel }: { onSubmit: (data: object) => void; onCancel: () => void }) {
  const [number, setNumber] = useState(''); const [capacity, setCapacity] = useState('4');
  return <FormShell onCancel={onCancel} submitLabel="Adicionar mesa" onSubmit={(event) => { event.preventDefault(); onSubmit({ number: Number(number), capacity: Number(capacity) }); }}><label>Número da mesa<input autoFocus type="number" min="1" max="9999" required value={number} onChange={(event) => setNumber(event.target.value)} placeholder="Ex.: 12" /></label><label>Lugares<input type="number" min="1" max="100" required value={capacity} onChange={(event) => setCapacity(event.target.value)} /></label></FormShell>;
}

function MenuForm({ item, onSubmit, onCancel }: { item: MenuItem | null; onSubmit: (data: object) => void | Promise<void>; onCancel: () => void }) {
  const [form, setForm] = useState({ name: item?.name ?? '', description: item?.description ?? '', category: item?.category ?? '', price: item?.price ?? '' });
  const change = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  return <FormShell onCancel={onCancel} submitLabel="Salvar no cardápio" onSubmit={(event) => { event.preventDefault(); onSubmit({ ...form, price: Number(form.price), category: form.category || 'Geral' }); }}><label>Nome do item<input autoFocus required maxLength={100} value={form.name} onChange={(event) => change('name', event.target.value)} placeholder="Ex.: Moqueca da casa" /></label><div className="form-two"><label>Categoria<input value={form.category} onChange={(event) => change('category', event.target.value)} placeholder="Pratos principais" /></label><label>Preço (R$)<input required type="number" min="0.01" step="0.01" value={form.price} onChange={(event) => change('price', event.target.value)} placeholder="0,00" /></label></div><label>Descrição <span className="optional-label">opcional</span><textarea rows={3} maxLength={500} value={form.description} onChange={(event) => change('description', event.target.value)} placeholder="Conte um pouco sobre o prato" /></label></FormShell>;
}

function ExpenseForm({ onSubmit, onCancel }: { onSubmit: (data: object) => void; onCancel: () => void }) {
  const [description, setDescription] = useState(''); const [amount, setAmount] = useState(''); const [incurredAt, setIncurredAt] = useState(localDate(new Date()));
  return <FormShell onCancel={onCancel} submitLabel="Registrar despesa" onSubmit={(event) => { event.preventDefault(); onSubmit({ description, amount: Number(amount), incurredAt: new Date(`${incurredAt}T12:00:00`).toISOString() }); }}><label>O que foi pago?<input autoFocus required maxLength={160} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Ex.: Compra de ingredientes" /></label><div className="form-two"><label>Valor (R$)<input required type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0,00" /></label><label>Data<input type="date" required value={incurredAt} onChange={(event) => setIncurredAt(event.target.value)} /></label></div></FormShell>;
}

function PaymentForm({ onSubmit, onCancel }: { onSubmit: (method: string) => void | Promise<void>; onCancel: () => void }) {
  const [method, setMethod] = useState('PIX');
  return <div className="payment-form"><p>Como o cliente pagou esta conta?</p><div className="payment-options">{Object.entries(paymentLabels).map(([value, label]) => <button key={value} className={method === value ? 'payment-option chosen' : 'payment-option'} onClick={() => setMethod(value)}><span className={`payment-symbol ${value.toLowerCase()}`}>{value === 'CASH' ? <Banknote size={16} /> : value === 'PIX' ? <Sparkles size={16} /> : <CreditCard size={16} />}</span>{label}<i /></button>)}</div><div className="form-actions"><button className="button button-light" onClick={onCancel}>Cancelar</button><button className="button button-dark" onClick={() => onSubmit(method)}>Confirmar pagamento</button></div></div>;
}
