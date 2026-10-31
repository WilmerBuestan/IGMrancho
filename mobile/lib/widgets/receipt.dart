import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../core/api.dart';
import '../core/theme.dart';

/// Miniatura del comprobante; al tocarla se abre en pantalla completa con zoom.
class ReceiptThumb extends StatelessWidget {
  const ReceiptThumb({super.key, required this.url, required this.isPdf, this.size = 64, required this.heroTag});
  final String url;
  final bool isPdf;
  final double size;
  final String heroTag;

  @override
  Widget build(BuildContext context) {
    final full = api.url(url);
    return GestureDetector(
      onTap: () => isPdf ? launchUrl(Uri.parse(full), mode: LaunchMode.externalApplication) : openReceipt(context, full, heroTag),
      child: Hero(
        tag: heroTag,
        child: ClipRRect(
          borderRadius: BorderRadius.circular(14),
          child: Container(
            width: size,
            height: size,
            color: context.subtle,
            child: isPdf
                ? const Center(child: Text('📄\nPDF', textAlign: TextAlign.center, style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12)))
                : Image.network(full, fit: BoxFit.cover, errorBuilder: (_, _, _) => const Icon(Icons.broken_image_outlined)),
          ),
        ),
      ),
    );
  }
}

void openReceipt(BuildContext context, String url, String heroTag) {
  Navigator.of(context).push(PageRouteBuilder(
    opaque: false,
    barrierColor: Colors.black87,
    pageBuilder: (_, _, _) => Scaffold(
      backgroundColor: Colors.transparent,
      appBar: AppBar(backgroundColor: Colors.transparent, title: const Text('Comprobante')),
      body: Center(
        child: Hero(
          tag: heroTag,
          child: InteractiveViewer(maxScale: 5, child: Image.network(url)),
        ),
      ),
    ),
    transitionsBuilder: (_, a, _, c) => FadeTransition(opacity: a, child: c),
  ));
}
