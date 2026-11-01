import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/api.dart';
import '../../core/format.dart';
import '../../core/meals.dart';
import '../../core/models.dart';
import '../../core/theme.dart';
import '../../widgets/common.dart';
import '../../widgets/receipt.dart';
import 'admin_shell.dart';
import 'reports.dart' show shareCsv;
import 'reservation_form.dart';

class ReservationsScreen extends StatefulWidget {
  const ReservationsScreen({super.key, this.date, this.status});
  final String? date;
  final String? status;
  @override
  State<ReservationsScreen> createState() => _ReservationsScreenState();
}

class _ReservationsScreenState extends State<ReservationsScreen> {
  String? date;
  Status? filter;
  String q = '';
  DayList? data;
  String? error;
  Timer? debounce;

  @override
  void initState() {
    super.initState();
    _apply();
  }

  @override
  void didUpdateWidget(ReservationsScreen old) {
    super.didUpdateWidget(old);
    // Llegó desde una notificación o un atajo del dashboard
    if (old.date != widget.date || old.status != widget.status) _apply();
  }

  void _apply() {
    date = widget.date ?? date;
    filter = widget.status == null ? filter : Status.parse(widget.status!);
    _load();
  }

  Future<void> _load() async {
    try {
      final r = await api.dayList(date, q: q);
      if (mounted) setState(() => (data = r, date = r.date, error = null));
    } on ApiException catch (e) {
      if (mounted) setState(() => error = e.message);
    }
  }

  void _shift(int days) {
    HapticFeedback.selectionClick();
    setState(() => date = isoDay(parseDay(date!).add(Duration(days: days))));
    _load();
  }

  Future<void> _pickDate() async {
    final d = await showDatePicker(
      context: context,
      initialDate: parseDay(date!),
      firstDate: DateTime(2026),
      lastDate: DateTime.now().add(const Duration(days: 365)),
    );
    if (d != null) {
      setState(() => date = isoDay(d));
      _load();
    }
  }

  @override
  Widget build(BuildContext context) {
    if (error != null && data == null) return ErrorView(error!, onRetry: _load);
    final d = data;
    if (d == null) return const LoadingList();
    final list = d.reservations.where((r) => filter == null || r.status == filter).toList();
    return Scaffold(
      backgroundColor: Colors.transparent,
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _openForm(null),
        icon: const Icon(Icons.add_rounded),
        label: const Text('Nueva'),
      ),
      body: RefreshIndicator(
      onRefresh: _load,
      child: CustomScrollView(slivers: [
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
          sliver: SliverList.list(children: [
            Row(children: [
              IconButton.filledTonal(onPressed: () => _shift(-1), icon: const Icon(Icons.chevron_left_rounded)),
              Expanded(
                child: InkWell(
                  borderRadius: BorderRadius.circular(12),
                  onTap: _pickDate,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 6),
                    child: Column(children: [
                      Text(longDate(d.date), textAlign: TextAlign.center, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
                      Text('Toca para elegir fecha', style: TextStyle(fontSize: 11, color: context.muted)),
                    ]),
                  ),
                ),
              ),
              IconButton.filledTonal(onPressed: () => _shift(1), icon: const Icon(Icons.chevron_right_rounded)),
            ]),
            const SizedBox(height: 12),
            Row(children: [
              for (final m in Meal.values)
                Expanded(
                  child: Card(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      child: Column(children: [
                        Text(m.emoji, style: const TextStyle(fontSize: 18)),
                        AnimatedCount(d.activas.qty[m]!, style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800)),
                        Text('${m.label}s', style: TextStyle(fontSize: 11, color: context.muted)),
                      ]),
                    ),
                  ),
                ),
            ].expand((w) => [w, const SizedBox(width: 8)]).toList()..removeLast()),
            const SizedBox(height: 8),
            Text('Aprobado: ${money(d.aprobadas.totalCents)} · Por verificar: ${d.pendientes.count}',
                textAlign: TextAlign.center, style: TextStyle(color: context.muted, fontSize: 13)),
            const SizedBox(height: 12),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(children: [
                for (final f in <Status?>[null, ...Status.values])
                  Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: ChoiceChip(
                      label: Text(f?.label ?? 'Todas'),
                      selected: filter == f,
                      onSelected: (_) => setState(() => filter = f),
                    ),
                  ),
                ActionChip(
                  avatar: const Icon(Icons.ios_share_rounded, size: 16),
                  label: const Text('Excel'),
                  onPressed: () => shareCsv(context, 'date=${d.date}', 'igm-rancho-${d.date}.csv'),
                ),
              ]),
            ),
            const SizedBox(height: 10),
            TextField(
              decoration: const InputDecoration(hintText: 'Buscar nombre, cédula o código', prefixIcon: Icon(Icons.search_rounded), isDense: true),
              onChanged: (v) {
                q = v.trim();
                debounce?.cancel();
                debounce = Timer(const Duration(milliseconds: 350), _load);
              },
            ),
            if (!d.driveEnabled)
              Padding(
                padding: const EdgeInsets.only(top: 10),
                child: Text('Drive no configurado: las capturas quedan solo en el servidor.', style: TextStyle(color: context.muted, fontSize: 12)),
              ),
            const SizedBox(height: 8),
          ]),
        ),
        if (list.isEmpty)
          SliverFillRemaining(
            hasScrollBody: false,
            child: Center(child: Text('Sin reservas', style: TextStyle(color: context.muted))),
          ),
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 96),
          sliver: SliverList.separated(
            itemCount: list.length,
            separatorBuilder: (_, _) => const SizedBox(height: 10),
            itemBuilder: (_, i) {
              final r = list[i];
              return Card(
                child: InkWell(
                  borderRadius: BorderRadius.circular(20),
                  onTap: () => _review(r),
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Row(children: [
                      ReceiptThumb(url: r.receiptUrl, isPdf: r.isPdf, heroTag: 'adm-${r.id}', size: 62),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Row(children: [
                            Expanded(child: Text(r.fullName, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w700))),
                            StatusBadge(r.status),
                          ]),
                          Text('${r.cedula} · ${r.code}${r.createdBy == 'admin' ? ' · por admin' : ''}${r.updatedAt != null ? ' · editada' : ''}',
                              style: TextStyle(fontSize: 12, color: context.muted)),
                          const SizedBox(height: 2),
                          Row(children: [
                            Expanded(child: Text(mealsText(r.qty), style: const TextStyle(fontSize: 13))),
                            Text(money(r.totalCents), style: const TextStyle(fontWeight: FontWeight.w800)),
                          ]),
                        ]),
                      ),
                    ]),
                  ),
                ),
              ).animate().fadeIn(delay: (40 * i.clamp(0, 10)).ms).slideX(begin: 0.05);
            },
          ),
        ),
      ]),
      ),
    );
  }

  Future<void> _openForm(Reservation? r) async {
    final saved = await Navigator.of(context).push<Reservation>(
      MaterialPageRoute(builder: (_) => ReservationFormScreen(r: r, defaultDate: date ?? isoDay(DateTime.now().add(const Duration(days: 1))))),
    );
    if (saved == null || !mounted) return;
    toast(context, r == null ? '✅ Reserva ${saved.code} creada' : '✓ Reserva actualizada');
    if (saved.serviceDate != date) setState(() => date = saved.serviceDate);
    _load();
    refreshPending();
  }

  Future<void> _review(Reservation r) async {
    final changed = await showModalBottomSheet<Object>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      useSafeArea: true,
      builder: (_) => ReviewSheet(r: r),
    );
    if (changed == 'edit') return _openForm(r);
    if (changed == true) {
      _load();
      refreshPending();
    }
  }
}

class ReviewSheet extends StatefulWidget {
  const ReviewSheet({super.key, required this.r});
  final Reservation r;
  @override
  State<ReviewSheet> createState() => _ReviewSheetState();
}

class _ReviewSheetState extends State<ReviewSheet> {
  late final note = TextEditingController(text: widget.r.adminNote ?? '');
  bool saving = false;
  List<HistoryItem> history = [];

  @override
  void initState() {
    super.initState();
    api.history(widget.r.id).then((h) => mounted ? setState(() => history = h) : null).catchError((_) {});
  }

  Future<void> _delete() async {
    final reason = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        icon: const Icon(Icons.delete_outline_rounded, color: Brand.danger, size: 40),
        title: Text('¿Eliminar ${widget.r.code}?'),
        content: Column(mainAxisSize: MainAxisSize.min, children: [
          const Text('Se quitará de las listas y reportes. Queda registrada en el historial.'),
          const SizedBox(height: 12),
          TextField(controller: reason, decoration: const InputDecoration(labelText: 'Motivo (opcional)', hintText: 'Ej. Reserva duplicada')),
        ]),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Cancelar')),
          FilledButton(style: FilledButton.styleFrom(backgroundColor: Brand.danger), onPressed: () => Navigator.pop(c, true), child: const Text('Eliminar')),
        ],
      ),
    );
    if (ok != true) return;
    setState(() => saving = true);
    try {
      await api.deleteReservation(widget.r.id, reason.text.trim());
      HapticFeedback.mediumImpact();
      if (mounted) {
        toast(context, '🗑️ Reserva eliminada');
        Navigator.pop(context, true);
      }
    } on ApiException catch (e) {
      if (mounted) toast(context, e.message, error: true);
      setState(() => saving = false);
    }
  }

  String _describe(HistoryItem h) {
    final d = h.detail;
    switch (h.action) {
      case 'estado':
        return '${d['de']} → ${d['a']}${d['nota'] != null ? ' · "${d['nota']}"' : ''}';
      case 'creada':
        return 'por ${d['por'] ?? 'cliente'}';
      case 'editada':
        return d.entries.map((e) {
          if (e.key == 'comprobante') return 'comprobante reemplazado';
          final c = e.value as Map;
          String f(dynamic x) => e.key == 'total' ? money((x as num).toInt()) : '${x ?? '—'}';
          return '${e.key}: ${f(c['de'])} → ${f(c['a'])}';
        }).join(' · ');
    }
    return '';
  }

  Future<void> _save(Status s) async {
    setState(() => saving = true);
    try {
      await api.setStatus(widget.r.id, s, note.text.trim());
      HapticFeedback.mediumImpact();
      if (mounted) {
        toast(context, s == Status.aprobada ? '✅ Pago aprobado' : (s == Status.rechazada ? 'Pago rechazado' : 'Vuelto a por verificar'));
        Navigator.pop(context, true);
      }
    } on ApiException catch (e) {
      if (mounted) toast(context, e.message, error: true);
      setState(() => saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final r = widget.r;
    final img = r.hasReceipt ? api.url(r.receiptUrl!) : '';
    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.92,
      maxChildSize: 0.95,
      builder: (_, ctrl) => ListView(
        controller: ctrl,
        padding: EdgeInsets.fromLTRB(16, 0, 16, 24 + MediaQuery.of(context).viewInsets.bottom),
        children: [
          if (!r.hasReceipt)
            Container(
              height: 160,
              alignment: Alignment.center,
              decoration: BoxDecoration(color: context.subtle, borderRadius: BorderRadius.circular(18)),
              child: const Text('💵\nSin comprobante · registrada por la administración', textAlign: TextAlign.center),
            )
          else GestureDetector(
            onTap: () => r.isPdf ? launchUrl(Uri.parse(img), mode: LaunchMode.externalApplication) : openReceipt(context, img, 'sheet-${r.id}'),
            child: Hero(
              tag: 'sheet-${r.id}',
              child: ClipRRect(
                borderRadius: BorderRadius.circular(18),
                child: Container(
                  height: 340,
                  color: Colors.black,
                  child: r.isPdf
                      ? const Center(child: Text('📄 Abrir PDF', style: TextStyle(color: Colors.white, fontSize: 18)))
                      : Image.network(img, fit: BoxFit.contain),
                ),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Text('Toca la captura para hacer zoom', textAlign: TextAlign.center, style: TextStyle(fontSize: 12, color: context.muted)),
          ),
          const SizedBox(height: 12),
          Text(r.fullName, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
          Text('${r.cedula}\n${r.email}', style: TextStyle(color: context.muted)),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(color: context.subtle, borderRadius: BorderRadius.circular(16)),
            child: Column(children: [
              _row('Código', r.code),
              _row('Fecha', longDate(r.serviceDate)),
              _row('Ranchos', mealsText(r.qty)),
              _row('Enviada', '${r.createdAt.day}/${r.createdAt.month} ${r.createdAt.hour.toString().padLeft(2, '0')}:${r.createdAt.minute.toString().padLeft(2, '0')}'),
              const Divider(),
              _row('Total', money(r.totalCents), big: true),
            ]),
          ),
          const SizedBox(height: 10),
          Row(children: [
            Text('Estado: ', style: TextStyle(color: context.muted)),
            StatusBadge(r.status),
            const Spacer(),
            if (r.driveLink != null)
              TextButton.icon(
                onPressed: () => launchUrl(Uri.parse(r.driveLink!), mode: LaunchMode.externalApplication),
                icon: const Icon(Icons.cloud_outlined, size: 18),
                label: const Text('Drive'),
              ),
          ]),
          const SizedBox(height: 10),
          TextField(
            controller: note,
            maxLines: 2,
            decoration: const InputDecoration(labelText: 'Nota para la persona (opcional)', hintText: 'Ej. El monto no coincide'),
          ),
          const SizedBox(height: 14),
          Row(children: [
            Expanded(
              child: OutlinedButton.icon(
                style: OutlinedButton.styleFrom(foregroundColor: Brand.danger, minimumSize: const Size(0, 54)),
                onPressed: saving ? null : () => _save(Status.rechazada),
                icon: const Icon(Icons.close_rounded),
                label: const Text('Rechazar'),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: FilledButton.icon(
                onPressed: saving ? null : () => _save(Status.aprobada),
                icon: const Icon(Icons.check_rounded),
                label: const Text('Aprobar'),
              ),
            ),
          ]),
          if (r.status != Status.pendiente)
            TextButton(onPressed: saving ? null : () => _save(Status.pendiente), child: const Text('Volver a "por verificar"')),
          const Divider(height: 24),
          Row(children: [
            Expanded(
              child: OutlinedButton.icon(
                onPressed: saving ? null : () => Navigator.pop(context, 'edit'),
                icon: const Icon(Icons.edit_rounded),
                label: const Text('Editar datos'),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: OutlinedButton.icon(
                style: OutlinedButton.styleFrom(foregroundColor: Brand.danger),
                onPressed: saving ? null : _delete,
                icon: const Icon(Icons.delete_outline_rounded),
                label: const Text('Eliminar'),
              ),
            ),
          ]),
          if (history.isNotEmpty) ...[
            const SizedBox(height: 12),
            ExpansionTile(
              tilePadding: EdgeInsets.zero,
              title: Text('Historial de cambios (${history.length})', style: const TextStyle(fontWeight: FontWeight.w700)),
              children: [
                for (final h in history)
                  ListTile(
                    dense: true,
                    contentPadding: EdgeInsets.zero,
                    leading: Text(const {'creada': '🆕', 'editada': '✏️', 'estado': '🔄', 'eliminada': '🗑️'}[h.action] ?? '•', style: const TextStyle(fontSize: 18)),
                    title: Text(_describe(h)),
                    subtitle: Text('${h.at.day}/${h.at.month} ${h.at.hour.toString().padLeft(2, '0')}:${h.at.minute.toString().padLeft(2, '0')}'),
                  ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _row(String k, String v, {bool big = false}) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 3),
        child: Row(children: [
          Text(k, style: TextStyle(color: context.muted, fontSize: big ? 16 : 14)),
          const SizedBox(width: 12),
          Expanded(child: Text(v, textAlign: TextAlign.right, style: TextStyle(fontWeight: FontWeight.w700, fontSize: big ? 20 : 14))),
        ]),
      );
}
