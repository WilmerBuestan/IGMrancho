import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../core/models.dart';
import '../core/theme.dart';

/// "¿Algún problema? Comunícate con Erick Acosta" con botones de WhatsApp y llamada.
class ContactCard extends StatelessWidget {
  const ContactCard({super.key, required this.contact, this.dark = false, this.title = '¿Algún problema con tu reserva?'});
  final Contact? contact;
  final bool dark;
  final String title;

  @override
  Widget build(BuildContext context) {
    final c = contact;
    if (c == null || c.phone.isEmpty) return const SizedBox.shrink();
    final fg = dark ? Colors.white : context.colors.onSurface;
    final sub = dark ? Brand.green100 : context.muted;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: dark ? Colors.white.withValues(alpha: 0.08) : context.colors.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: dark ? Colors.white24 : (context.isDark ? Colors.white12 : Brand.green100)),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(children: [
          CircleAvatar(radius: 22, backgroundColor: dark ? Colors.white12 : context.subtle, child: const Text('🙋', style: TextStyle(fontSize: 20))),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(title, style: TextStyle(fontWeight: FontWeight.w700, color: fg)),
              Text.rich(TextSpan(style: TextStyle(color: sub, fontSize: 13), children: [
                const TextSpan(text: 'Comunícate con '),
                TextSpan(text: c.name, style: const TextStyle(fontWeight: FontWeight.w700)),
                TextSpan(text: ' · ${c.pretty}'),
              ])),
            ]),
          ),
        ]),
        const SizedBox(height: 12),
        Row(children: [
          Expanded(
            child: FilledButton.icon(
              style: FilledButton.styleFrom(backgroundColor: const Color(0xFF25D366), foregroundColor: Colors.white, minimumSize: const Size(0, 46)),
              onPressed: () => launchUrl(
                Uri.parse('https://wa.me/${c.waNumber}?text=${Uri.encodeComponent('Hola, tengo una consulta sobre mi reserva en IGM Rancho.')}'),
                mode: LaunchMode.externalApplication,
              ),
              icon: const Icon(Icons.chat_rounded, size: 18),
              label: const Text('WhatsApp'),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: OutlinedButton.icon(
              style: OutlinedButton.styleFrom(
                minimumSize: const Size(0, 46),
                foregroundColor: dark ? Colors.white : null,
                side: dark ? const BorderSide(color: Colors.white38) : null,
              ),
              onPressed: () => launchUrl(Uri.parse('tel:${c.phone.replaceAll(' ', '')}')),
              icon: const Icon(Icons.call_rounded, size: 18),
              label: const Text('Llamar'),
            ),
          ),
        ]),
      ]),
    );
  }
}
