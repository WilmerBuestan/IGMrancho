import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';

import '../../core/api.dart';
import '../../core/format.dart';
import '../../core/models.dart';
import '../../core/profile.dart';
import '../../core/push.dart';
import '../../core/theme.dart';
import '../../widgets/common.dart';
import '../../widgets/receipt.dart';
import '../../widgets/contact.dart';

class LookupScreen extends StatefulWidget {
  const LookupScreen({super.key});
  @override
  State<LookupScreen> createState() => _LookupScreenState();
}

class _LookupScreenState extends State<LookupScreen> {
  final cedula = TextEditingController(text: profile.cedula);
  final email = TextEditingController(text: profile.email);
  List<Reservation>? list;
  Contact? contact;
  String? error;
  bool loading = false;

  @override
  void initState() {
    super.initState();
    api.config().then((c) => mounted ? setState(() => contact = c.contact) : null).catchError((_) {});
    if (profile.complete) _search();
  }

  Future<void> _search() async {
    FocusScope.of(context).unfocus();
    setState(() => (loading = true, error = null));
    try {
      final r = await api.lookup(cedula.text.trim(), email.text.trim().toLowerCase());
      if (!profile.complete && r.isNotEmpty) {
        await profile.save(fullName: r.first.fullName, cedula: cedula.text.trim(), email: email.text.trim().toLowerCase());
        push.syncClient();
      }
      if (mounted) setState(() => list = r);
    } on ApiException catch (e) {
      if (mounted) setState(() => error = e.message);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: _search,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 20, 16, 32),
        children: [
          const Text('Mis reservas', style: TextStyle(fontSize: 30, fontWeight: FontWeight.w800)),
          const SizedBox(height: 14),
          ContactCard(contact: contact, title: '¿Algo está mal en tu reserva?'),
          const SizedBox(height: 14),
          if (!profile.complete || list == null)
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  TextField(
                    controller: cedula,
                    keyboardType: TextInputType.number,
                    maxLength: 10,
                    inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                    decoration: const InputDecoration(labelText: 'Cédula', counterText: ''),
                  ),
                  const SizedBox(height: 12),
                  TextField(controller: email, keyboardType: TextInputType.emailAddress, decoration: const InputDecoration(labelText: 'Correo institucional')),
                  const SizedBox(height: 12),
                  FilledButton(onPressed: loading ? null : _search, child: Text(loading ? 'Buscando…' : 'Buscar')),
                ]),
              ),
            ),
          if (error != null) Padding(padding: const EdgeInsets.only(top: 12), child: Text(error!, style: const TextStyle(color: Brand.danger))),
          if (loading && list == null) const SizedBox(height: 300, child: LoadingList(count: 3)),
          if (list != null && list!.isEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 40),
              child: Column(children: [
                const Text('🍽️', style: TextStyle(fontSize: 56)),
                const SizedBox(height: 8),
                Text('Aún no tienes reservas.', style: TextStyle(color: context.muted)),
              ]),
            ),
          for (final (i, r) in (list ?? <Reservation>[]).indexed)
            Padding(
              padding: const EdgeInsets.only(top: 12),
              child: Card(
                child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    ReceiptThumb(url: r.receiptUrl, isPdf: r.isPdf, heroTag: 'rc-${r.id}', size: 72),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Row(children: [
                          Expanded(child: Text(longDate(r.serviceDate), style: const TextStyle(fontWeight: FontWeight.w700))),
                          StatusBadge(r.status),
                        ]),
                        const SizedBox(height: 4),
                        Text(mealsText(r.qty), style: TextStyle(color: context.muted)),
                        const SizedBox(height: 4),
                        Row(children: [
                          Text(r.code, style: TextStyle(color: context.muted, fontSize: 12, letterSpacing: 1)),
                          const Spacer(),
                          Text(money(r.totalCents), style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
                        ]),
                        if (r.adminNote != null) ...[
                          const SizedBox(height: 8),
                          Container(
                            width: double.infinity,
                            padding: const EdgeInsets.all(10),
                            decoration: BoxDecoration(color: context.subtle, borderRadius: BorderRadius.circular(12)),
                            child: Text('💬 ${r.adminNote}', style: const TextStyle(fontSize: 13)),
                          ),
                        ],
                      ]),
                    ),
                  ]),
                ),
              ),
            ).animate().fadeIn(delay: (60 * i).ms).slideY(begin: 0.15),
        ],
      ),
    );
  }
}
