/// Servidor de IGM Rancho. Se puede cambiar al compilar:
/// flutter build apk --dart-define=API_URL=http://192.168.100.134:8085
const apiUrl = String.fromEnvironment('API_URL', defaultValue: 'https://rancho.simtrg.date');
const webUrl = apiUrl;
