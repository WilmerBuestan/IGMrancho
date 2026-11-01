import 'dart:io';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';

import '../../core/api.dart';
import '../../core/format.dart';
import '../../core/meals.dart';
import '../../core/models.dart';
import '../../core/theme.dart';
import '../../widgets/common.dart';

/// Crear (r == null) o editar una reserva desde el panel del admin.
class ReservationFormScreen extends StatefulWidget {
  const ReservationFormScreen({super.key, this.r, required this.defaultDate});
  final Reservation? r;
  final String defaultDate;
  @override
  State<ReservationFormScreen> createState() => _ReservationFormScreenState();
}

class _ReservationFormScreenState extends State<ReservationFormScreen> {
  late final r = widget.r;
  late final name = TextEditingController(text: r?.fullName ?? '');
  late final cedula = TextEditingController(text: r?.cedula ?? '');
  late final email = TextEditingController(text: r?.email ?? '');
  late final note = TextEditingController(text: r?.adminNote ?? '');
  final total = TextEditingController();
  late String date = r?.serviceDate ?? widget.defaultDate;
  late Qty qty = r == null ? emptyQty() : Map.of(r!.qty);
  late Status status = r?.status ?? Status.aprobada;
  bool manualTotal = false;
  Qty? prices;
  File? file;
  String? mime;
  bool saving = false;
  final formKey = GlobalKey<FormState>();

  @override
  void initState() {
    super.initState();
    if (r != null) total.text = (r!.totalCents / 100).toStringAsFixed(2);
    api.settings().then((s) {
      if (!mounted) return;
      setState(() => prices = s.prices);
      if (r == null) _recalc();
    }).catchError((_) {});
  }

  bool get qtyChanged => r == null || Meal.values.any((m) => qty[m] != r!.qty[m]);

  void _recalc() {
    if (manualTotal || prices == null) return;
    final cents = qtyChanged ? Meal.values.fold(0, (a, m) => a + qty[m]! * prices![m]!) : r!.totalCents;
    total.text = (cents / 100).toStringAsFixed(2);
  }

  Future<void> _pickDate() async {
    final d = await showDatePicker(context: context, initialDate: parseDay(date), firstDate: DateTime(2026), lastDate: DateTime.now().add(const Duration(days: 365)));
    if (d != null) setState(() => date = isoDay(d));
  }

  Future<void> _pickFile() async {
    final choice = await showModalBottomSheet<String>(
      context: context,
      showDragHandle: true,
      builder: (c) => SafeArea(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          ListTile(leading: const Icon(Icons.photo_library_outlined), title: const Text('Galería'), onTap: () => Navigator.pop(c, 'gallery')),
          ListTile(leading: const Icon(Icons.photo_camera_outlined), title: const Text('Cámara'), onTap: () => Navigator.pop(c, 'camera')),
          ListTile(leading: const Icon(Icons.picture_as_pdf_outlined), title: const Text('PDF'), onTap: () => Navigator.pop(c, 'pdf')),
        ]),
      ),
    );
    if (choice == null) return;
    if (choice == 'pdf') {
      final res = await FilePicker.pickFiles(type: FileType.custom, allowedExtensions: ['pdf']);
      if (res.isNotEmpty && res.single.path != null) setState(() => (file = File(res.single.path!), mime = 'application/pdf'));
      return;
    }
    final x = await ImagePicker().pickImage(source: choice == 'camera' ? ImageSource.camera : ImageSource.gallery, maxWidth: 2000, imageQuality: 88);
    if (x != null) setState(() => (file = File(x.path), mime = x.mimeType ?? 'image/jpeg'));
  }

  Future<void> _save() async {
    if (!(formKey.currentState?.validate() ?? false)) return;
    if (qty.values.every((v) => v == 0)) return toast(context, 'Elige al menos un rancho', error: true);
    setState(() => saving = true);
    try {
      final saved = await api.saveReservation(
        id: r?.id,
        fields: {
          'fullName': name.text.trim(),
          'cedula': cedula.text.trim(),
          'email': email.text.trim(),
          'serviceDate': date,
          for (final m in Meal.values) m.name: qty[m],
          'status': status.name,
          'adminNote': note.text.trim(),
          if (manualTotal) 'totalCents': ((double.tryParse(total.text.replaceAll(',', '.')) ?? 0) * 100).round(),
        },
        file: file,
        mime: mime,
      );
      HapticFeedback.mediumImpact();
      if (mounted) Navigator.pop(context, saved);
    } on ApiException catch (e) {
      if (mounted) toast(context, e.message, error: true);
      setState(() => saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(r == null ? 'Nueva reserva' : 'Editar ${r!.code}')),
      body: Form(
        key: formKey,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 110),
          children: [
            Text(r == null ? 'Para quien paga en efectivo o te escribió directamente.' : 'Corrige lo que la persona ingresó mal.',
                style: TextStyle(color: context.muted)),
            const SizedBox(height: 14),
            TextFormField(
              controller: name,
              textCapitalization: TextCapitalization.words,
              decoration: const InputDecoration(labelText: 'Grado y nombre completo'),
              validator: (v) => (v ?? '').trim().length < 3 ? 'Ingresa el nombre' : null,
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
            TextFormField(controller: email, keyboardType: TextInputType.emailAddress, decoration: const InputDecoration(labelText: 'Correo (opcional)')),
            const SizedBox(height: 12),
            Row(children: [
              Expanded(
                child: OutlinedButton.icon(onPressed: _pickDate, icon: const Icon(Icons.event_rounded), label: Text(shortDate(date))),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: DropdownButtonFormField<Status>(
                  initialValue: status,
                  decoration: const InputDecoration(labelText: 'Estado', contentPadding: EdgeInsets.symmetric(horizontal: 14, vertical: 10)),
                  items: [for (final s in Status.values) DropdownMenuItem(value: s, child: Text(s.label))],
                  onChanged: (v) => setState(() => status = v ?? status),
                ),
              ),
            ]),
            const SizedBox(height: 14),
            Card(
              child: Column(children: [
                for (final m in Meal.values)
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 8, 10, 8),
                    child: Row(children: [
                      Text(m.emoji, style: const TextStyle(fontSize: 24)),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text(m.label, style: const TextStyle(fontWeight: FontWeight.w700)),
                          if (prices != null) Text(money(prices![m]!), style: TextStyle(color: context.muted, fontSize: 12)),
                        ]),
                      ),
                      QtyStepper(value: qty[m]!, onChanged: (v) => setState(() {
                            qty[m] = v;
                            manualTotal = false;
                            _recalc();
                          })),
                    ]),
                  ),
              ]),
            ),
            const SizedBox(height: 14),
            TextField(
              controller: total,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800),
              decoration: InputDecoration(
                labelText: 'Total',
                prefixText: '\$ ',
                helperText: manualTotal ? 'Total escrito a mano' : (r != null && !qtyChanged ? 'Total original' : 'Calculado con los precios actuales'),
              ),
              onChanged: (_) => manualTotal = true,
            ),
            const SizedBox(height: 14),
            InkWell(
              borderRadius: BorderRadius.circular(16),
              onTap: _pickFile,
              child: Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: file != null ? Brand.green500 : (context.isDark ? Colors.white24 : Brand.green100), width: 2),
                ),
                child: Row(children: [
                  Text(file != null ? '📄' : '📎', style: const TextStyle(fontSize: 26)),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      file != null ? 'Comprobante nuevo listo' : (r?.hasReceipt == true ? 'Cambiar comprobante (opcional)' : 'Agregar comprobante (opcional)'),
                      style: const TextStyle(fontWeight: FontWeight.w600),
                    ),
                  ),
                ]),
              ),
            ),
            const SizedBox(height: 14),
            TextField(controller: note, decoration: const InputDecoration(labelText: 'Nota para la persona', hintText: 'Ej. Pagó en efectivo')),
          ],
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: saving ? null : _save,
        icon: saving ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.save_rounded),
        label: Text(r == null ? 'Crear reserva' : 'Guardar cambios'),
      ),
    );
  }
}
