import 'dart:async';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:receive_sharing_intent/receive_sharing_intent.dart';

class SharedReceipt {
  SharedReceipt(this.file, this.mime);
  final File file;
  final String mime;
}

/// Captura que llega con "Compartir → IGM Rancho" desde la app del banco.
class ShareInbox {
  ShareInbox._();
  static final instance = ShareInbox._();

  final pending = ValueNotifier<SharedReceipt?>(null);
  void Function()? onReceived;

  Future<void> start() async {
    try {
      ReceiveSharingIntent.instance.getMediaStream().listen(_handle);
      _handle(await ReceiveSharingIntent.instance.getInitialMedia());
      ReceiveSharingIntent.instance.reset();
    } catch (e) {
      debugPrint('Compartir no disponible: $e');
    }
  }

  void _handle(List<SharedMediaFile> files) {
    if (files.isEmpty) return;
    final f = files.first;
    final isPdf = f.path.toLowerCase().endsWith('.pdf') || (f.mimeType ?? '').contains('pdf');
    pending.value = SharedReceipt(File(f.path), isPdf ? 'application/pdf' : (f.mimeType ?? 'image/jpeg'));
    onReceived?.call();
  }

  SharedReceipt? take() {
    final r = pending.value;
    pending.value = null;
    return r;
  }
}

final shareInbox = ShareInbox.instance;
