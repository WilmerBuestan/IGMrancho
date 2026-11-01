import 'meals.dart';

int _i(dynamic v) => v is int ? v : (v is num ? v.toInt() : int.tryParse('$v') ?? 0);

Qty _qty(Map<String, dynamic> j) => {for (final m in Meal.values) m: _i(j[m.name])};

class Contact {
  Contact({required this.name, required this.phone});
  factory Contact.fromJson(Map<String, dynamic>? j) => Contact(name: j?['name'] ?? '', phone: j?['phone'] ?? '');
  String name, phone;
  Map<String, dynamic> toJson() => {'name': name, 'phone': phone};

  /// 0996038610 → 593996038610 (WhatsApp)
  String get waNumber {
    final d = phone.replaceAll(RegExp(r'\D'), '');
    return d.startsWith('593') ? d : (d.startsWith('0') ? '593${d.substring(1)}' : d);
  }

  String get pretty {
    final d = phone.replaceAll(RegExp(r'\D'), '');
    return d.length == 10 ? '${d.substring(0, 3)} ${d.substring(3, 6)} ${d.substring(6)}' : phone;
  }
}

class Account {
  Account({required this.titular, required this.banco, required this.tipo, required this.numero, required this.cedula});
  factory Account.fromJson(Map<String, dynamic> j) => Account(
        titular: j['titular'] ?? '',
        banco: j['banco'] ?? '',
        tipo: j['tipo'] ?? '',
        numero: j['numero'] ?? '',
        cedula: j['cedula'] ?? '',
      );
  String titular, banco, tipo, numero, cedula;
  Map<String, dynamic> toJson() => {'titular': titular, 'banco': banco, 'tipo': tipo, 'numero': numero, 'cedula': cedula};
}

class PublicConfig {
  PublicConfig.fromJson(Map<String, dynamic> j)
      : prices = _qty(j['prices']),
        cutoff = j['cutoff'],
        account = Account.fromJson(j['account']),
        notice = j['notice'] ?? '',
        open = j['open'] == true,
        qrUrl = j['qrUrl'],
        serviceDate = j['serviceDate'],
        deadline = j['deadline'],
        emailDomain = j['emailDomain'],
        closedDates = List<String>.from(j['closedDates'] ?? const []),
        contact = Contact.fromJson(j['contact']);
  final Contact contact;
  final Qty prices;
  final String cutoff;
  final Account account;
  final String notice;
  final bool open;
  final String? qrUrl;
  final String serviceDate;
  final String deadline;
  final String emailDomain;
  final List<String> closedDates;
}

enum Status {
  pendiente('Por verificar'),
  aprobada('Aprobada'),
  rechazada('Rechazada');

  const Status(this.label);
  final String label;
  static Status parse(String s) => Status.values.firstWhere((e) => e.name == s, orElse: () => Status.pendiente);
}

class Reservation {
  Reservation.fromJson(Map<String, dynamic> j)
      : id = j['id'],
        code = j['code'],
        serviceDate = j['serviceDate'],
        fullName = j['fullName'],
        cedula = j['cedula'],
        email = j['email'],
        qty = _qty(j),
        totalCents = _i(j['totalCents']),
        status = Status.parse(j['status']),
        adminNote = j['adminNote'],
        receiptMime = j['receiptMime'],
        receiptUrl = j['receiptUrl'],
        driveStatus = j['driveStatus'],
        driveLink = j['driveLink'],
        createdBy = j['createdBy'] ?? 'cliente',
        updatedAt = j['updatedAt'] == null ? null : DateTime.parse(j['updatedAt']).toLocal(),
        createdAt = DateTime.parse(j['createdAt']).toLocal();
  final String id, code, serviceDate, fullName, createdBy;
  final String? receiptMime, receiptUrl;
  final DateTime? updatedAt;
  final String? cedula, email, adminNote, driveStatus, driveLink;
  final Qty qty;
  final int totalCents;
  Status status;
  final DateTime createdAt;
  bool get isPdf => receiptMime == 'application/pdf';
  bool get hasReceipt => receiptUrl != null;
}

class Totals {
  Totals.fromJson(Map<String, dynamic> j)
      : qty = _qty(j),
        totalCents = _i(j['totalCents']),
        count = _i(j['count']);
  final Qty qty;
  final int totalCents, count;
}

class DayList {
  DayList.fromJson(Map<String, dynamic> j)
      : date = j['date'],
        driveEnabled = j['driveEnabled'] == true,
        activas = Totals.fromJson(j['summary']['activas']),
        aprobadas = Totals.fromJson(j['summary']['aprobadas']),
        pendientes = Totals.fromJson(j['summary']['pendientes']),
        reservations = (j['reservations'] as List).map((e) => Reservation.fromJson(e)).toList();
  final String date;
  final bool driveEnabled;
  final Totals activas, aprobadas, pendientes;
  final List<Reservation> reservations;
}

class DayStat {
  DayStat.fromJson(Map<String, dynamic> j)
      : date = j['date'],
        reservas = _i(j['reservas']),
        qty = _qty(j),
        aprobadoCents = _i(j['aprobadoCents']),
        pendienteCents = _i(j['pendienteCents']),
        pendientes = _i(j['pendientes']),
        rechazadas = _i(j['rechazadas']);
  final String date;
  final int reservas, aprobadoCents, pendienteCents, pendientes, rechazadas;
  final Qty qty;
  int get ranchos => qty.values.fold(0, (a, b) => a + b);
}

class PersonStat {
  PersonStat.fromJson(Map<String, dynamic> j)
      : cedula = j['cedula'],
        fullName = j['fullName'],
        email = j['email'] ?? '',
        reservas = _i(j['reservas']),
        qty = _qty(j),
        aprobadoCents = _i(j['aprobadoCents']),
        rechazadas = _i(j['rechazadas']);
  final String cedula, fullName, email;
  final int reservas, aprobadoCents, rechazadas;
  final Qty qty;
  int get ranchos => qty.values.fold(0, (a, b) => a + b);
}

class Stats {
  Stats.fromJson(Map<String, dynamic> j)
      : today = j['today'],
        tomorrow = j['tomorrow'],
        nextServiceDate = j['nextServiceDate'],
        daily = (j['daily'] as List).map((e) => DayStat.fromJson(e)).toList(),
        reservas = _i(j['totals']['reservas']),
        ranchos = _i(j['totals']['ranchos']),
        aprobadoCents = _i(j['totals']['aprobadoCents']),
        personas = _i(j['totals']['personas']),
        tasaAprobacion = (j['totals']['tasaAprobacion'] as num?)?.toDouble(),
        pendingCount = _i(j['pending']['n']),
        pendingCents = _i(j['pending']['cents']),
        topPeople = (j['topPeople'] as List).map((e) => PersonStat.fromJson(e)).toList(),
        byHour = {for (final h in j['byHour'] as List) _i(h['hour']): _i(h['n'])},
        driveEnabled = j['drive']['enabled'] == true,
        driveUploaded = _i(j['drive']['uploaded']),
        driveFailed = _i(j['drive']['failed']),
        open = j['settings']['open'] == true,
        cutoff = j['settings']['cutoff'];
  final String today, tomorrow, nextServiceDate, cutoff;
  final List<DayStat> daily;
  final int reservas, ranchos, aprobadoCents, personas, pendingCount, pendingCents, driveUploaded, driveFailed;
  final double? tasaAprobacion;
  final List<PersonStat> topPeople;
  final Map<int, int> byHour;
  final bool driveEnabled, open;
}

class Report {
  Report.fromJson(Map<String, dynamic> j)
      : from = j['from'],
        to = j['to'],
        days = (j['days'] as List).map((e) => DayStat.fromJson(e)).toList(),
        people = (j['people'] as List).map((e) => PersonStat.fromJson(e)).toList();
  final String from, to;
  final List<DayStat> days;
  final List<PersonStat> people;
}

class AdminSettings {
  AdminSettings.fromJson(Map<String, dynamic> j)
      : prices = _qty(j['prices']),
        cutoff = j['cutoff'],
        account = Account.fromJson(j['account']),
        qrFile = j['qrFile'],
        notice = j['notice'] ?? '',
        open = j['open'] == true,
        closedDates = List<String>.from(j['closedDates'] ?? const []),
        reminderMinutes = _i(j['reminderMinutes'] ?? 60),
        driveEnabled = j['driveEnabled'] == true,
        pushEnabled = j['pushEnabled'] == true,
        driveFolderUrl = j['driveFolderUrl'],
        contact = Contact.fromJson(j['contact']);
  final Contact contact;
  final Qty prices;
  final String cutoff, notice;
  final Account account;
  final String? qrFile, driveFolderUrl;
  final bool open, driveEnabled, pushEnabled;
  final List<String> closedDates;
  final int reminderMinutes;
}

class HistoryItem {
  HistoryItem.fromJson(Map<String, dynamic> j)
      : action = j['action'],
        detail = Map<String, dynamic>.from(j['detail'] ?? {}),
        at = DateTime.parse(j['at']).toLocal();
  final String action;
  final Map<String, dynamic> detail;
  final DateTime at;
}
