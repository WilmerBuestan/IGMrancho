import 'dart:io';

import 'package:confetti/confetti.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../../core/api.dart';
import '../../core/format.dart';
import '../../core/meals.dart';
import '../../core/models.dart';
import '../../core/profile.dart';
import '../../core/push.dart';
import '../../core/share_inbox.dart';
import '../../core/theme.dart';
import '../../widgets/common.dart';

class ReserveScreen extends StatefulWidget {
  const ReserveScreen({super.key});
  @override
  State<ReserveScreen> createState() => _ReserveScreenState();
}

class _ReserveScreenState extends State<ReserveScreen> {
  PublicConfig? cfg;
  String? error;
  Qty qty = emptyQty();
  final name = TextEditingController(text: profile.fullName);
  final cedula = TextEditingController(text: profile.cedula);
  final email = TextEditingController(text: profile.email);
  File? file;
  String? mime;
  bool sending = false;
  final formKey = GlobalKey<FormState>();
  final dataKey = GlobalKey();

  @override
  void initState() {
    super.initState();
    _load();
    _takeShared();
    shareInbox.pending.addListener(_takeShared);
  }

  @override
  void dispose() {
    shareInbox.pending.removeListener(_takeShared);
    super.dispose();
  }

  void _takeShared() {
    final r = shareInbox.take();
    if (r == null) return;
    setState(() {
      file = r.file;
      mime = r.mime;
    });
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) toast(context, '📎 Captura recibida. Elige tus ranchos y confirma.');
    });
  }

  Future<void> _load() async {
    setState(() => error = null);
    try {
      final c = await api.config();
      if (mounted) setState(() => cfg = c);
    } on ApiException catch (e) {
      if (mounted) setState(() => error = e.message);
    }
  }

  int get count => qty.values.fold(0, (a, b) => a + b);
  int get total => cfg == null ? 0 : Meal.values.fold(0, (a, m) => a + qty[m]! * cfg!.prices[m]!);

  Future<void> _pick(String source) async {
    Navigator.pop(context);
    if (source == 'pdf') {
      final r = await FilePicker.pickFiles(type: FileType.custom, allowedExtensions: ['pdf']);
      final p = r.isEmpty ? null : r.single.path;
      if (p != null) setState(() => (file = File(p), mime = 'application/pdf'));
      return;
    }
    final x = await ImagePicker().pickImage(
      source: source == 'camera' ? ImageSource.camera : ImageSource.gallery,
      maxWidth: 2000,
      imageQuality: 88,
    );
    if (x != null) setState(() => (file = File(x.path), mime = x.mimeType ?? 'image/jpeg'));
  }

  void _pickSheet() {
    showModalBottomSheet(
      context: context,
      showDragHandle: true,
      builder: (_) => SafeArea(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          ListTile(leading: const Icon(Icons.photo_library_outlined), title: const Text('Elegir captura de la galería'), onTap: () => _pick('gallery')),
          ListTile(leading: const Icon(Icons.photo_camera_outlined), title: const Text('Tomar foto'), onTap: () => _pick('camera')),
          ListTile(leading: const Icon(Icons.picture_as_pdf_outlined), title: const Text('Subir PDF'), onTap: () => _pick('pdf')),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 4, 20, 16),
            child: Text('Tip: en la app del banco toca "Compartir" y elige IGM Rancho.',
                style: TextStyle(color: context.muted, fontSize: 13)),
          ),
        ]),
      ),
    );
  }

  Future<void> _submit() async {
    if (count == 0) return toast(context, 'Elige al menos un rancho', error: true);
    if (!(formKey.currentState?.validate() ?? false)) {
      Scrollable.ensureVisible(dataKey.currentContext!, duration: 400.ms);
      return;
    }
    if (file == null) return toast(context, 'Sube la captura de tu transferencia', error: true);
    setState(() => sending = true);
    try {
      final r = await api.reserve(
        fullName: name.text.trim(),
        cedula: cedula.text.trim(),
        email: email.text.trim().toLowerCase(),
        qty: qty,
        file: file!,
        mime: mime ?? 'image/jpeg',
      );
      await profile.save(fullName: name.text.trim(), cedula: cedula.text.trim(), email: email.text.trim().toLowerCase(), order: qty);
      push.syncClient();
      HapticFeedback.heavyImpact();
      if (!mounted) return;
      await Navigator.of(context).push(PageRouteBuilder(
        pageBuilder: (_, _, _) => SuccessScreen(result: r),
        transitionsBuilder: (_, a, _, c) => FadeTransition(opacity: a, child: ScaleTransition(scale: Tween(begin: 0.95, end: 1.0).animate(a), child: c)),
      ));
      if (mounted) setState(() => (qty = emptyQty(), file = null));
    } on ApiException catch (e) {
      if (mounted) toast(context, e.message, error: true);
    } finally {
      if (mounted) setState(() => sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (error != null) return ErrorView(error!, onRetry: _load);
    final c = cfg;
    if (c == null) return const LoadingList(count: 3, height: 140);
    if (!c.open) {
      return ErrorView('🔒 Las reservas están cerradas por el momento.\n${c.notice}', onRetry: _load);
    }
    return Stack(children: [
      RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 20, 16, 120),
          children: [
            const Text('Reserva tu rancho', style: TextStyle(fontSize: 30, fontWeight: FontWeight.w800, letterSpacing: -0.5)),
            const SizedBox(height: 6),
            Text.rich(TextSpan(style: TextStyle(color: context.muted, fontSize: 15, height: 1.4), children: [
              const TextSpan(text: 'Para el '),
              TextSpan(text: longDate(c.serviceDate).toLowerCase(), style: TextStyle(fontWeight: FontWeight.w800, color: context.colors.onSurface)),
              TextSpan(text: '. Hasta el ${longDate(c.deadline.substring(0, 10)).toLowerCase()} a las ${c.cutoff}.'),
            ])),
            if (c.notice.isNotEmpty) ...[
              const SizedBox(height: 14),
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: Brand.gold.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: Brand.gold.withValues(alpha: 0.5)),
                ),
                child: Text('📣 ${c.notice}', style: const TextStyle(height: 1.4)),
              ).animate().fadeIn().slideX(begin: -0.05),
            ],
            if (profile.lastOrder != null && count == 0 && profile.lastOrder!.values.any((v) => v > 0)) ...[
              const SizedBox(height: 14),
              _RepeatChip(order: profile.lastOrder!, onTap: () {
                HapticFeedback.lightImpact();
                setState(() => qty = Map.of(profile.lastOrder!));
              }).animate().fadeIn(delay: 200.ms).shimmer(delay: 600.ms, duration: 1200.ms, color: Brand.gold.withValues(alpha: 0.4)),
            ],
            const SizedBox(height: 16),
            Card(
              child: Column(children: [
                const StepTitle(1, '¿Qué vas a reservar?'),
                for (final (i, m) in Meal.values.indexed)
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 6, 12, 10),
                    child: Row(children: [
                      Container(
                        width: 50,
                        height: 50,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(color: context.subtle, borderRadius: BorderRadius.circular(14)),
                        child: Text(m.emoji, style: const TextStyle(fontSize: 26)),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text(m.label, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                          Text('${money(c.prices[m]!)} c/u', style: TextStyle(color: context.muted)),
                        ]),
                      ),
                      QtyStepper(value: qty[m]!, onChanged: (v) => setState(() => qty[m] = v)),
                    ]),
                  ).animate().fadeIn(delay: (100 * i).ms).slideX(begin: 0.08),
              ]),
            ),
            const SizedBox(height: 16),
            _PayCard(cfg: c, total: total, count: count),
            const SizedBox(height: 16),
            Card(
              key: dataKey,
              child: Form(
                key: formKey,
                child: Padding(
                  padding: const EdgeInsets.only(bottom: 16),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                    const StepTitle(3, 'Tus datos y la captura'),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                        TextFormField(
                          controller: name,
                          textCapitalization: TextCapitalization.words,
                          decoration: const InputDecoration(labelText: 'Grado y nombre completo', hintText: 'Ej. Sgos. Juan Pérez'),
                          validator: (v) => (v ?? '').trim().length < 5 ? 'Ingresa tu nombre completo' : null,
                        ),
                        const SizedBox(height: 12),
                        TextFormField(
                          controller: cedula,
                          keyboardType: TextInputType.number,
                          maxLength: 10,
                          inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                          decoration: const InputDecoration(labelText: 'Cédula', counterText: ''),
                          validator: (v) => isValidCedula(v ?? '') ? null : 'Cédula no válida',
                        ),
                        const SizedBox(height: 12),
                        TextFormField(
                          controller: email,
                          keyboardType: TextInputType.emailAddress,
                          decoration: InputDecoration(labelText: 'Correo institucional', hintText: 'usuario@${c.emailDomain}'),
                          validator: (v) => (v ?? '').trim().toLowerCase().endsWith('@${c.emailDomain}') ? null : 'Debe terminar en @${c.emailDomain}',
                        ),
                        const SizedBox(height: 16),
                        _ReceiptPicker(file: file, mime: mime, onTap: _pickSheet),
                      ]),
                    ),
                  ]),
                ),
              ),
            ),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: sending ? null : _submit,
              style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(58)),
              child: sending
                  ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(strokeWidth: 3, color: Colors.white))
                  : Text('Confirmar reserva · ${money(total)}'),
            ),
          ],
        ),
      ),
      // Barra con el total que aparece al elegir ranchos
      Positioned(
        left: 12,
        right: 12,
        bottom: 12,
        child: AnimatedSlide(
          offset: count > 0 ? Offset.zero : const Offset(0, 1.6),
          duration: const Duration(milliseconds: 350),
          curve: Curves.easeOutBack,
          child: Material(
            elevation: 8,
            color: Brand.green900,
            borderRadius: BorderRadius.circular(20),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(18, 10, 10, 10),
              child: Row(children: [
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                    Text('$count rancho${count == 1 ? '' : 's'}', style: const TextStyle(color: Brand.green300, fontSize: 12)),
                    AnimatedCount(total, money: true, style: const TextStyle(color: Brand.gold, fontSize: 22, fontWeight: FontWeight.w800)),
                  ]),
                ),
                FilledButton(
                  style: FilledButton.styleFrom(backgroundColor: Brand.gold, foregroundColor: Brand.ink, minimumSize: const Size(0, 46)),
                  onPressed: () => Scrollable.ensureVisible(dataKey.currentContext!, duration: 500.ms, curve: Curves.easeOutCubic),
                  child: const Text('Continuar'),
                ),
              ]),
            ),
          ),
        ),
      ),
    ]);
  }
}

class _RepeatChip extends StatelessWidget {
  const _RepeatChip({required this.order, required this.onTap});
  final Qty order;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Material(
        color: context.isDark ? Brand.green700 : Brand.green100,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Row(children: [
              const Icon(Icons.replay_rounded),
              const SizedBox(width: 10),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const Text('Repetir mi última reserva', style: TextStyle(fontWeight: FontWeight.w700)),
                  Text(mealsText(order), style: TextStyle(color: context.muted, fontSize: 13)),
                ]),
              ),
              const Icon(Icons.chevron_right_rounded),
            ]),
          ),
        ),
      );
}

class _PayCard extends StatelessWidget {
  const _PayCard({required this.cfg, required this.total, required this.count});
  final PublicConfig cfg;
  final int total, count;
  @override
  Widget build(BuildContext context) {
    final a = cfg.account;
    final rows = [('Titular', a.titular), ('Banco', a.banco), ('Cuenta', a.tipo), ('Cédula', a.cedula)].where((r) => r.$2.isNotEmpty);
    return Card(
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        const StepTitle(2, 'Transfiere el valor'),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
              decoration: BoxDecoration(color: Brand.green900, borderRadius: BorderRadius.circular(18)),
              child: Row(children: [
                Text(count == 0 ? 'Total a pagar' : '$count rancho${count == 1 ? '' : 's'}', style: const TextStyle(color: Brand.green300)),
                const Spacer(),
                AnimatedCount(total, money: true, style: const TextStyle(color: Brand.gold, fontSize: 30, fontWeight: FontWeight.w800)),
              ]),
            ),
            if (cfg.qrUrl != null) ...[
              const SizedBox(height: 14),
              GestureDetector(
                onTap: () => _showQr(context, api.url(cfg.qrUrl!)),
                child: Hero(
                  tag: 'qr',
                  child: Container(
                    height: 260,
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(18)),
                    child: Image.network(api.url(cfg.qrUrl!), fit: BoxFit.contain),
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Text('Toca el QR para agrandarlo', textAlign: TextAlign.center, style: TextStyle(fontSize: 12, color: context.muted)),
              ),
            ],
            const SizedBox(height: 10),
            for (final r in rows)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 3),
                child: Row(children: [
                  Text(r.$1, style: TextStyle(color: context.muted)),
                  const Spacer(),
                  Text(r.$2, style: const TextStyle(fontWeight: FontWeight.w600)),
                ]),
              ),
            if (a.numero.isNotEmpty) ...[
              const SizedBox(height: 8),
              OutlinedButton.icon(
                onPressed: () {
                  Clipboard.setData(ClipboardData(text: a.numero));
                  HapticFeedback.lightImpact();
                  toast(context, 'Número de cuenta copiado');
                },
                icon: const Icon(Icons.copy_rounded, size: 18),
                label: Text(a.numero, style: const TextStyle(fontSize: 17, letterSpacing: 1.5, fontFeatures: [FontFeature.tabularFigures()])),
              ),
            ],
          ]),
        ),
      ]),
    );
  }

  void _showQr(BuildContext context, String url) {
    Navigator.of(context).push(PageRouteBuilder(
      opaque: false,
      barrierColor: Colors.black87,
      barrierDismissible: true,
      pageBuilder: (ctx, _, _) => GestureDetector(
        onTap: () => Navigator.pop(ctx),
        child: Center(
          child: Hero(
            tag: 'qr',
            child: Container(
              margin: const EdgeInsets.all(24),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(24)),
              child: Image.network(url),
            ),
          ),
        ),
      ),
      transitionsBuilder: (_, a, _, c) => FadeTransition(opacity: a, child: c),
    ));
  }
}

class _ReceiptPicker extends StatelessWidget {
  const _ReceiptPicker({required this.file, required this.mime, required this.onTap});
  final File? file;
  final String? mime;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    final has = file != null;
    final isPdf = mime == 'application/pdf';
    return InkWell(
      borderRadius: BorderRadius.circular(18),
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 300),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(18),
          color: has ? (context.isDark ? Brand.green700.withValues(alpha: 0.4) : Brand.green50) : null,
          border: Border.all(color: has ? Brand.green500 : (context.isDark ? Colors.white24 : Brand.green100), width: 2),
        ),
        child: Row(children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: SizedBox(
              width: 72,
              height: 72,
              child: has && !isPdf
                  ? Image.file(file!, fit: BoxFit.cover)
                  : Container(color: context.subtle, alignment: Alignment.center, child: Text(has ? '📄' : '📷', style: const TextStyle(fontSize: 30))),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(has ? 'Captura lista ✓' : 'Sube la captura de la transferencia', style: const TextStyle(fontWeight: FontWeight.w700)),
              Text(has ? 'Toca para cambiarla' : 'Galería, cámara o PDF', style: TextStyle(color: context.muted, fontSize: 13)),
            ]),
          ),
        ]),
      ),
    );
  }
}

class SuccessScreen extends StatefulWidget {
  const SuccessScreen({super.key, required this.result});
  final Map<String, dynamic> result;
  @override
  State<SuccessScreen> createState() => _SuccessScreenState();
}

class _SuccessScreenState extends State<SuccessScreen> {
  final confetti = ConfettiController(duration: const Duration(seconds: 2));

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => confetti.play());
  }

  @override
  void dispose() {
    confetti.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final r = widget.result;
    final qty = {for (final m in Meal.values) m: (r[m.name] ?? 0) as int};
    return Scaffold(
      body: Stack(children: [
        Container(decoration: const BoxDecoration(gradient: Brand.heroGradient)),
        SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(children: [
              const Spacer(),
              Container(
                width: 110,
                height: 110,
                decoration: const BoxDecoration(color: Brand.gold, shape: BoxShape.circle),
                child: const Icon(Icons.check_rounded, size: 70, color: Brand.ink),
              ).animate().scale(duration: 600.ms, curve: Curves.elasticOut),
              const SizedBox(height: 24),
              const Text('¡Reserva enviada!', style: TextStyle(color: Colors.white, fontSize: 30, fontWeight: FontWeight.w800))
                  .animate().fadeIn(delay: 200.ms).slideY(begin: 0.3),
              const SizedBox(height: 6),
              const Text('Te avisaremos cuando se verifique tu pago.', textAlign: TextAlign.center, style: TextStyle(color: Brand.green100))
                  .animate().fadeIn(delay: 350.ms),
              const SizedBox(height: 28),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(24)),
                child: Column(children: [
                  const Text('CÓDIGO DE RESERVA', style: TextStyle(color: Brand.green500, letterSpacing: 2, fontSize: 12, fontWeight: FontWeight.w700)),
                  const SizedBox(height: 4),
                  Text(r['code'], style: const TextStyle(fontSize: 30, fontWeight: FontWeight.w800, letterSpacing: 2, color: Brand.ink)),
                  const Divider(height: 28),
                  Text(longDate(r['serviceDate']), style: const TextStyle(fontWeight: FontWeight.w700, color: Brand.ink)),
                  Text(mealsText(qty), style: const TextStyle(color: Brand.green600)),
                  const SizedBox(height: 6),
                  Text(money(r['totalCents']), style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: Brand.ink)),
                ]),
              ).animate().fadeIn(delay: 450.ms).slideY(begin: 0.2, curve: Curves.easeOutCubic),
              const Spacer(),
              FilledButton(
                style: FilledButton.styleFrom(backgroundColor: Brand.gold, foregroundColor: Brand.ink, minimumSize: const Size.fromHeight(56)),
                onPressed: () {
                  Navigator.pop(context);
                  context.go('/mis-reservas');
                },
                child: const Text('Ver mis reservas'),
              ),
              TextButton(onPressed: () => Navigator.pop(context), child: const Text('Hacer otra reserva', style: TextStyle(color: Colors.white))),
            ]),
          ),
        ),
        Align(
          alignment: Alignment.topCenter,
          child: ConfettiWidget(
            confettiController: confetti,
            blastDirectionality: BlastDirectionality.explosive,
            numberOfParticles: 30,
            gravity: 0.25,
            colors: const [Brand.gold, Colors.white, Brand.green300, Color(0xFFEB6834), Color(0xFF2A78D6)],
          ),
        ),
      ]),
    );
  }
}
