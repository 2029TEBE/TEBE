/**
 * Frontend-only English-source label catalog.
 * This deliberately does not modify @pmo/contracts translations, which also
 * power the EN/AR backend document exports.
 *
 * Initially covers the shared navigation groups and a handful of stable
 * navigation terms. Missing translations intentionally show English. The
 * provided legacy Arabic label remains authoritative for existing nav items.
 * The catalog is not evidence of full DE/ZH/FR/JA language coverage.
 */
export const UI_LABELS = Object.freeze({
  'Home': { 'de-DE': 'Startseite', 'zh-CN': '首页', 'fr-FR': 'Accueil', 'ja-JP': 'ホーム'  , 'ur': "ہوم" , 'es': "Inicio", 'es-419': "Inicio" , 'pt-BR': "Início", 'pt-PT': "Início", 'it': "Pagina iniziale", 'tr': "Ana Sayfa", 'ru': "Главная" , 'bn': "হোম", 'fil': "Tahanan", 'hi': "मुखपृष्ठ", 'id': "Beranda", 'ko': "홈", 'sw': "Nyumbani", 'vi': "Trang chủ", 'zh-TW': "首頁" },
  'Plan & Deliver': { 'de-DE': 'Planung und Umsetzung', 'zh-CN': '规划与交付', 'fr-FR': 'Planifier et réaliser', 'ja-JP': '計画と実行'  , 'ur': "منصوبہ بندی اور تکمیل" , 'es': "Planificar y ejecutar", 'es-419': "Planificación y ejecución" , 'pt-BR': "Planejar e executar", 'pt-PT': "Planear e executar", 'it': "Pianificazione e attuazione", 'tr': "Planlama ve Teslim", 'ru': "Планирование и реализация" , 'bn': "পরিকল্পনা ও বাস্তবায়ন", 'fil': "Magplano at magsagawa", 'hi': "योजना और निष्पादन", 'id': "Rencanakan dan laksanakan", 'ko': "계획 및 실행", 'sw': "Panga na tekeleza", 'vi': "Lập kế hoạch và triển khai", 'zh-TW': "規劃與交付" },
  'Govern': { 'de-DE': 'Governance', 'zh-CN': '治理', 'fr-FR': 'Gouvernance', 'ja-JP': 'ガバナンス'  , 'ur': "گورننس" , 'es': "Gobernanza", 'es-419': "Gobernanza" , 'pt-BR': "Governança", 'pt-PT': "Governação", 'it': "Governance", 'tr': "Yönetişim", 'ru': "Управление" , 'bn': "শাসনব্যবস্থা", 'fil': "Pamamahala", 'hi': "शासन", 'id': "Tata kelola", 'ko': "거버넌스", 'sw': "Utawala", 'vi': "Quản trị", 'zh-TW': "治理" },
  'Analyse': { 'de-DE': 'Analyse', 'zh-CN': '分析', 'fr-FR': 'Analyse', 'ja-JP': '分析'  , 'ur': "تجزیہ" , 'es': "Analizar", 'es-419': "Analizar" , 'pt-BR': "Analisar", 'pt-PT': "Analisar", 'it': "Analisi", 'tr': "Analiz", 'ru': "Анализ" , 'bn': "বিশ্লেষণ", 'fil': "Suriin", 'hi': "विश्लेषण", 'id': "Analisis", 'ko': "분석", 'sw': "Changanua", 'vi': "Phân tích", 'zh-TW': "分析" },
  'Collaborate': { 'de-DE': 'Zusammenarbeit', 'zh-CN': '协作', 'fr-FR': 'Collaboration', 'ja-JP': '共同作業'  , 'ur': "تعاون" , 'es': "Colaborar", 'es-419': "Colaborar" , 'pt-BR': "Colaborar", 'pt-PT': "Colaborar", 'it': "Collaborazione", 'tr': "İş Birliği", 'ru': "Совместная работа" , 'bn': "সহযোগিতা", 'fil': "Makipagtulungan", 'hi': "सहयोग", 'id': "Kolaborasi", 'ko': "협업", 'sw': "Shirikiana", 'vi': "Cộng tác", 'zh-TW': "協作" },
  'Configure': { 'de-DE': 'Konfiguration', 'zh-CN': '配置', 'fr-FR': 'Configuration', 'ja-JP': '設定'  , 'ur': "ترتیبات" , 'es': "Configurar", 'es-419': "Configurar" , 'pt-BR': "Configurar", 'pt-PT': "Configurar", 'it': "Configurazione", 'tr': "Yapılandırma", 'ru': "Настройка" , 'bn': "কনফিগার করুন", 'fil': "Isaayos", 'hi': "कॉन्फ़िगर करें", 'id': "Konfigurasi", 'ko': "설정 구성", 'sw': "Sanidi", 'vi': "Cấu hình", 'zh-TW': "設定" },
  'Projects': { 'de-DE': 'Projekte', 'zh-CN': '项目', 'fr-FR': 'Projets', 'ja-JP': 'プロジェクト'  , 'ur': "منصوبے" , 'es': "Proyectos", 'es-419': "Proyectos" , 'pt-BR': "Projetos", 'pt-PT': "Projetos", 'it': "Progetti", 'tr': "Projeler", 'ru': "Проекты" , 'bn': "প্রকল্পসমূহ", 'fil': "Mga proyekto", 'hi': "परियोजनाएँ", 'id': "Proyek", 'ko': "프로젝트", 'sw': "Miradi", 'vi': "Dự án", 'zh-TW': "專案" },
  'Reports': { 'de-DE': 'Berichte', 'zh-CN': '报告', 'fr-FR': 'Rapports', 'ja-JP': 'レポート'  , 'ur': "رپورٹس" , 'es': "Informes", 'es-419': "Reportes" , 'pt-BR': "Relatórios", 'pt-PT': "Relatórios", 'it': "Rapporti", 'tr': "Raporlar", 'ru': "Отчёты" , 'bn': "প্রতিবেদনসমূহ", 'fil': "Mga ulat", 'hi': "रिपोर्ट", 'id': "Laporan", 'ko': "보고서", 'sw': "Ripoti", 'vi': "Báo cáo", 'zh-TW': "報表" },
  'Settings': { 'de-DE': 'Einstellungen', 'zh-CN': '设置', 'fr-FR': 'Paramètres', 'ja-JP': '設定'  , 'ur': "سیٹنگز" , 'es': "Configuración", 'es-419': "Configuración" , 'pt-BR': "Configurações", 'pt-PT': "Definições", 'it': "Impostazioni", 'tr': "Ayarlar", 'ru': "Настройки" , 'bn': "সেটিংস", 'fil': "Mga setting", 'hi': "सेटिंग", 'id': "Pengaturan", 'ko': "설정", 'sw': "Mipangilio", 'vi': "Cài đặt", 'zh-TW': "設定選項" },
  "Getting Started": { 'de-DE': "Erste Schritte", 'zh-CN': "入门指南", 'fr-FR': "Premiers pas", 'ja-JP': "はじめに"  , 'ur': "شروعات" , 'es': "Primeros pasos", 'es-419': "Primeros pasos" , 'pt-BR': "Primeiros passos", 'pt-PT': "Primeiros passos", 'it': "Per iniziare", 'tr': "Başlarken", 'ru': "Начало работы" , 'bn': "শুরু করুন", 'fil': "Pagsisimula", 'hi': "शुरू करें", 'id': "Memulai", 'ko': "시작하기", 'sw': "Anza hapa", 'vi': "Bắt đầu", 'zh-TW': "開始使用" },
  "Executive Overview": { 'de-DE': "Managementübersicht", 'zh-CN': "管理层概览", 'fr-FR': "Vue d’ensemble de direction", 'ja-JP': "エグゼクティブ概要"  , 'ur': "انتظامی جائزہ" , 'es': "Resumen ejecutivo", 'es-419': "Resumen ejecutivo" , 'pt-BR': "Visão executiva", 'pt-PT': "Visão executiva", 'it': "Panoramica direzionale", 'tr': "Yönetici özeti", 'ru': "Обзор для руководства" , 'bn': "নির্বাহী সারসংক্ষেপ", 'fil': "Buod para sa pamunuan", 'hi': "कार्यकारी अवलोकन", 'id': "Ringkasan eksekutif", 'ko': "경영진 개요", 'sw': "Muhtasari wa uongozi", 'vi': "Tổng quan điều hành", 'zh-TW': "高階主管總覽" },
  "My Work": { 'de-DE': "Meine Aufgaben", 'zh-CN': "我的工作", 'fr-FR': "Mon travail", 'ja-JP': "自分の作業"  , 'ur': "میرا کام" , 'es': "Mi trabajo", 'es-419': "Mi trabajo" , 'pt-BR': "Meu trabalho", 'pt-PT': "O meu trabalho", 'it': "Il mio lavoro", 'tr': "İşlerim", 'ru': "Моя работа" , 'bn': "আমার কাজ", 'fil': "Aking mga gawain", 'hi': "मेरा कार्य", 'id': "Pekerjaan saya", 'ko': "내 업무", 'sw': "Kazi zangu", 'vi': "Công việc của tôi", 'zh-TW': "我的工作" },
  "Attention": { 'de-DE': "Handlungsbedarf", 'zh-CN': "待关注事项", 'fr-FR': "Points d’attention", 'ja-JP': "要対応"  , 'ur': "توجہ طلب" , 'es': "Atención", 'es-419': "Atención" , 'pt-BR': "Atenção", 'pt-PT': "Atenção", 'it': "Da attenzionare", 'tr': "Dikkat Gerektirenler", 'ru': "Требует внимания" , 'bn': "মনোযোগ প্রয়োজন", 'fil': "Kailangang bigyang-pansin", 'hi': "ध्यान आवश्यक", 'id': "Perlu perhatian", 'ko': "주의 필요", 'sw': "Inahitaji uangalizi", 'vi': "Cần chú ý", 'zh-TW': "待關注" },
  "Portfolios": { 'de-DE': "Portfolios", 'zh-CN': "项目组合", 'fr-FR': "Portefeuilles", 'ja-JP': "ポートフォリオ"  , 'ur': "پروجیکٹ پورٹ فولیوز" , 'es': "Carteras", 'es-419': "Portafolios" , 'pt-BR': "Portfólios", 'pt-PT': "Portefólios", 'it': "Portafogli", 'tr': "Portföyler", 'ru': "Портфели" , 'bn': "পোর্টফোলিওসমূহ", 'fil': "Mga portfolio", 'hi': "पोर्टफोलियो", 'id': "Portofolio", 'ko': "포트폴리오", 'sw': "Mikusanyiko ya miradi", 'vi': "Danh mục đầu tư", 'zh-TW': "專案組合" },
  "Work Board": { 'de-DE': "Aufgabenboard", 'zh-CN': "工作看板", 'fr-FR': "Tableau de travail", 'ja-JP': "作業ボード"  , 'ur': "کام کا بورڈ" , 'es': "Tablero de trabajo", 'es-419': "Tablero de trabajo" , 'pt-BR': "Quadro de trabalho", 'pt-PT': "Quadro de trabalho", 'it': "Bacheca delle attività", 'tr': "İş Panosu", 'ru': "Доска задач" , 'bn': "কাজের বোর্ড", 'fil': "Lupon ng gawain", 'hi': "कार्य बोर्ड", 'id': "Papan kerja", 'ko': "업무 보드", 'sw': "Ubao wa kazi", 'vi': "Bảng công việc", 'zh-TW': "工作看板" },
  "Schedule": { 'de-DE': "Zeitplan", 'zh-CN': "进度计划", 'fr-FR': "Calendrier", 'ja-JP': "スケジュール"  , 'ur': "شیڈول" , 'es': "Calendario", 'es-419': "Cronograma" , 'pt-BR': "Cronograma", 'pt-PT': "Calendário", 'it': "Pianificazione", 'tr': "Takvim", 'ru': "График" , 'bn': "সময়সূচি", 'fil': "Iskedyul", 'hi': "समय-सारणी", 'id': "Jadwal", 'ko': "일정", 'sw': "Ratiba", 'vi': "Lịch trình", 'zh-TW': "時程" },
  "Stage Gates": { 'de-DE': "Phasenfreigaben", 'zh-CN': "阶段关卡", 'fr-FR': "Jalons de validation", 'ja-JP': "ステージゲート"  , 'ur': "مرحلہ وار منظوری" , 'es': "Puertas de fase", 'es-419': "Puntos de aprobación por etapa" , 'pt-BR': "Marcos de aprovação", 'pt-PT': "Portões de fase", 'it': "Verifiche di fase", 'tr': "Aşama Onayları", 'ru': "Контрольные точки этапов" , 'bn': "ধাপভিত্তিক অনুমোদন", 'fil': "Mga pag-apruba sa yugto", 'hi': "चरण अनुमोदन", 'id': "Gerbang tahapan", 'ko': "단계별 승인", 'sw': "Vibali vya hatua", 'vi': "Cổng phê duyệt giai đoạn", 'zh-TW': "階段關卡" },
  "RAID Register": { 'de-DE': "RAID-Register", 'zh-CN': "RAID 登记簿", 'fr-FR': "Registre RAID", 'ja-JP': "RAID台帳"  , 'ur': "خطرات، مفروضات، مسائل اور انحصار کا رجسٹر" , 'es': "Registro RAID", 'es-419': "Registro RAID" , 'pt-BR': "Registro RAID", 'pt-PT': "Registo RAID", 'it': "Registro RAID", 'tr': "RAID Kaydı", 'ru': "Реестр RAID" , 'bn': "ঝুঁকি ও সমস্যার নিবন্ধন", 'fil': "Talaan ng RAID", 'hi': "RAID रजिस्टर", 'id': "Daftar RAID", 'ko': "RAID 등록부", 'sw': "Rejesta ya RAID", 'vi': "Sổ theo dõi RAID", 'zh-TW': "RAID 登錄表" },
  "Decisions": { 'de-DE': "Entscheidungen", 'zh-CN': "决策", 'fr-FR': "Décisions", 'ja-JP': "意思決定"  , 'ur': "فیصلے" , 'es': "Decisiones", 'es-419': "Decisiones" , 'pt-BR': "Decisões", 'pt-PT': "Decisões", 'it': "Decisioni", 'tr': "Kararlar", 'ru': "Решения" , 'bn': "সিদ্ধান্তসমূহ", 'fil': "Mga pasya", 'hi': "निर्णय", 'id': "Keputusan", 'ko': "의사결정", 'sw': "Maamuzi", 'vi': "Quyết định", 'zh-TW': "決策" },
  "Approvals": { 'de-DE': "Genehmigungen", 'zh-CN': "审批", 'fr-FR': "Approbations", 'ja-JP': "承認"  , 'ur': "منظوریاں" , 'es': "Aprobaciones", 'es-419': "Aprobaciones" , 'pt-BR': "Aprovações", 'pt-PT': "Aprovações", 'it': "Approvazioni", 'tr': "Onaylar", 'ru': "Согласования" , 'bn': "অনুমোদনসমূহ", 'fil': "Mga pag-apruba", 'hi': "अनुमोदन", 'id': "Persetujuan", 'ko': "승인", 'sw': "Idhini", 'vi': "Phê duyệt", 'zh-TW': "核准" },
  "Analytics": { 'de-DE': "Analysen", 'zh-CN': "分析报告", 'fr-FR': "Analytique", 'ja-JP': "分析"  , 'ur': "تجزیاتی معلومات" , 'es': "Análisis", 'es-419': "Analítica" , 'pt-BR': "Análises", 'pt-PT': "Análise de dados", 'it': "Analisi dei dati", 'tr': "Analitik", 'ru': "Аналитика" , 'bn': "তথ্য বিশ্লেষণ", 'fil': "Pagsusuri ng datos", 'hi': "डेटा विश्लेषिकी", 'id': "Analitik", 'ko': "데이터 분석", 'sw': "Uchanganuzi wa data", 'vi': "Phân tích dữ liệu", 'zh-TW': "數據分析" },
  "Financials": { 'de-DE': "Finanzen", 'zh-CN': "财务", 'fr-FR': "Finances", 'ja-JP': "財務"  , 'ur': "مالی امور" , 'es': "Finanzas", 'es-419': "Finanzas" , 'pt-BR': "Finanças", 'pt-PT': "Finanças", 'it': "Finanze", 'tr': "Finans", 'ru': "Финансы" , 'bn': "আর্থিক বিষয়", 'fil': "Pananalapi", 'hi': "वित्तीय विवरण", 'id': "Keuangan", 'ko': "재무", 'sw': "Fedha", 'vi': "Tài chính", 'zh-TW': "財務" },
  "Benefits": { 'de-DE': "Nutzen", 'zh-CN': "效益", 'fr-FR': "Bénéfices", 'ja-JP': "効果"  , 'ur': "فوائد" , 'es': "Beneficios", 'es-419': "Beneficios" , 'pt-BR': "Benefícios", 'pt-PT': "Benefícios", 'it': "Benefici", 'tr': "Faydalar", 'ru': "Выгоды" , 'bn': "সুফলসমূহ", 'fil': "Mga benepisyo", 'hi': "लाभ", 'id': "Manfaat", 'ko': "기대효과", 'sw': "Manufaa", 'vi': "Lợi ích", 'zh-TW': "效益" },
  "Resources": { 'de-DE': "Ressourcen", 'zh-CN': "资源", 'fr-FR': "Ressources", 'ja-JP': "リソース"  , 'ur': "وسائل" , 'es': "Recursos", 'es-419': "Recursos" , 'pt-BR': "Recursos", 'pt-PT': "Recursos", 'it': "Risorse", 'tr': "Kaynaklar", 'ru': "Ресурсы" , 'bn': "সম্পদসমূহ", 'fil': "Mga mapagkukunan", 'hi': "संसाधन", 'id': "Sumber daya", 'ko': "자원", 'sw': "Rasilimali", 'vi': "Nguồn lực", 'zh-TW': "資源" },
  "Notifications": { 'de-DE': "Benachrichtigungen", 'zh-CN': "通知", 'fr-FR': "Notifications", 'ja-JP': "通知"  , 'ur': "اطلاعات" , 'es': "Notificaciones", 'es-419': "Notificaciones" , 'pt-BR': "Notificações", 'pt-PT': "Notificações", 'it': "Notifiche", 'tr': "Bildirimler", 'ru': "Уведомления" , 'bn': "বিজ্ঞপ্তিসমূহ", 'fil': "Mga abiso", 'hi': "सूचनाएँ", 'id': "Notifikasi", 'ko': "알림", 'sw': "Arifa", 'vi': "Thông báo", 'zh-TW': "通知" },
  "Import & Export": { 'de-DE': "Import und Export", 'zh-CN': "导入与导出", 'fr-FR': "Importation et exportation", 'ja-JP': "インポートとエクスポート"  , 'ur': "درآمد اور برآمد" , 'es': "Importar y exportar", 'es-419': "Importar y exportar" , 'pt-BR': "Importar e exportar", 'pt-PT': "Importar e exportar", 'it': "Importazione ed esportazione", 'tr': "İçe ve Dışa Aktarma", 'ru': "Импорт и экспорт" , 'bn': "আমদানি ও রপ্তানি", 'fil': "Mag-import at mag-export", 'hi': "आयात और निर्यात", 'id': "Impor dan ekspor", 'ko': "가져오기 및 내보내기", 'sw': "Ingiza na hamisha", 'vi': "Nhập và xuất", 'zh-TW': "匯入與匯出" },
  "Power BI": { 'de-DE': "Power BI", 'zh-CN': "Power BI", 'fr-FR': "Power BI", 'ja-JP': "Power BI"  , 'ur': "Power BI" , 'es': "Power BI", 'es-419': "Power BI" , 'pt-BR': "Power BI", 'pt-PT': "Power BI", 'it': "Power BI", 'tr': "Power BI", 'ru': "Power BI" , 'bn': "Power BI", 'fil': "Power BI", 'hi': "Power BI", 'id': "Power BI", 'ko': "Power BI", 'sw': "Power BI", 'vi': "Power BI", 'zh-TW': "Power BI" },
  "Platform Studio": { 'de-DE': "Plattformstudio", 'zh-CN': "平台工作室", 'fr-FR': "Studio de plateforme", 'ja-JP': "プラットフォームスタジオ"  , 'ur': "پلیٹ فارم اسٹوڈیو" , 'es': "Estudio de plataforma", 'es-419': "Estudio de plataforma" , 'pt-BR': "Estúdio da plataforma", 'pt-PT': "Estúdio da plataforma", 'it': "Studio della piattaforma", 'tr': "Platform Stüdyosu", 'ru': "Студия платформы" , 'bn': "প্ল্যাটফর্ম স্টুডিও", 'fil': "Studio ng plataporma", 'hi': "प्लेटफ़ॉर्म स्टूडियो", 'id': "Studio platform", 'ko': "플랫폼 스튜디오", 'sw': "Studio ya jukwaa", 'vi': "Xưởng nền tảng", 'zh-TW': "平台工作室" },
  "Integrations": { 'de-DE': "Integrationen", 'zh-CN': "集成", 'fr-FR': "Intégrations", 'ja-JP': "連携"  , 'ur': "انضمام" , 'es': "Integraciones", 'es-419': "Integraciones" , 'pt-BR': "Integrações", 'pt-PT': "Integrações", 'it': "Integrazioni", 'tr': "Entegrasyonlar", 'ru': "Интеграции" , 'bn': "সমন্বয়সমূহ", 'fil': "Mga integrasyon", 'hi': "एकीकरण", 'id': "Integrasi", 'ko': "연동", 'sw': "Miunganisho", 'vi': "Tích hợp", 'zh-TW': "整合" },
  "Billing & Renewals": { 'de-DE': "Abrechnung und Verlängerungen", 'zh-CN': "账单与续订", 'fr-FR': "Facturation et renouvellements", 'ja-JP': "請求と更新"  , 'ur': "بلنگ اور تجدید" , 'es': "Facturación y renovaciones", 'es-419': "Facturación y renovaciones" , 'pt-BR': "Faturamento e renovações", 'pt-PT': "Faturação e renovações", 'it': "Fatturazione e rinnovi", 'tr': "Faturalandırma ve Yenilemeler", 'ru': "Выставление счетов и продление" , 'bn': "বিলিং ও নবায়ন", 'fil': "Pagsingil at pag-renew", 'hi': "बिलिंग और नवीनीकरण", 'id': "Penagihan dan perpanjangan", 'ko': "청구 및 갱신", 'sw': "Malipo na uhuishaji", 'vi': "Thanh toán và gia hạn", 'zh-TW': "帳單與續訂" },
  "Subscriptions": { 'de-DE': "Abonnements", 'zh-CN': "订阅", 'fr-FR': "Abonnements", 'ja-JP': "サブスクリプション"  , 'ur': "سبسکرپشنز" , 'es': "Suscripciones", 'es-419': "Suscripciones" , 'pt-BR': "Assinaturas", 'pt-PT': "Subscrições", 'it': "Abbonamenti", 'tr': "Abonelikler", 'ru': "Подписки" , 'bn': "সাবস্ক্রিপশনসমূহ", 'fil': "Mga subscription", 'hi': "सदस्यताएँ", 'id': "Langganan", 'ko': "구독", 'sw': "Usajili", 'vi': "Gói đăng ký", 'zh-TW': "訂閱" },
  'Documents': { 'de-DE': 'Dokumente', 'zh-CN': '文档', 'fr-FR': 'Documents', 'ja-JP': '文書'  , 'ur': "دستاویزات" , 'es': "Documentos", 'es-419': "Documentos" , 'pt-BR': "Documentos", 'pt-PT': "Documentos", 'it': "Documenti", 'tr': "Belgeler", 'ru': "Документы" , 'bn': "নথিপত্র", 'fil': "Mga dokumento", 'hi': "दस्तावेज़", 'id': "Dokumen", 'ko': "문서", 'sw': "Nyaraka", 'vi': "Tài liệu", 'zh-TW': "文件" },
  'Updates': { 'de-DE': 'Aktuelles', 'zh-CN': '最新动态', 'fr-FR': 'Actualités', 'ja-JP': '更新情報'  , 'ur': "تازہ ترین معلومات" , 'es': "Actualizaciones", 'es-419': "Actualizaciones" , 'pt-BR': "Atualizações", 'pt-PT': "Atualizações", 'it': "Aggiornamenti", 'tr': "Güncellemeler", 'ru': "Обновления" , 'bn': "হালনাগাদ তথ্য", 'fil': "Mga pagbabago", 'hi': "अद्यतन", 'id': "Pembaruan", 'ko': "업데이트", 'sw': "Taarifa mpya", 'vi': "Cập nhật", 'zh-TW': "更新" },
  'Stakeholders': { 'de-DE': 'Stakeholder', 'zh-CN': '利益相关方', 'fr-FR': 'Parties prenantes', 'ja-JP': 'ステークホルダー'  , 'ur': "متعلقہ فریق" , 'es': "Partes interesadas", 'es-419': "Partes interesadas" , 'pt-BR': "Partes interessadas", 'pt-PT': "Partes interessadas", 'it': "Parti interessate", 'tr': "Paydaşlar", 'ru': "Заинтересованные стороны" , 'bn': "অংশীজন", 'fil': "Mga stakeholder", 'hi': "हितधारक", 'id': "Pemangku kepentingan", 'ko': "이해관계자", 'sw': "Wadau", 'vi': "Các bên liên quan", 'zh-TW': "利害關係人" },
  "Executive decision journey": { 'ar-SA': "مسار القرار التنفيذي", 'de-DE': "Weg zur Managemententscheidung", 'zh-CN': "管理决策流程", 'fr-FR': "Parcours de décision de direction", 'ja-JP': "経営判断の流れ" },
  "FROM SIGNALS TO DECISIONS": { 'ar-SA': "من المؤشرات إلى القرار", 'de-DE': "VON SIGNALEN ZU ENTSCHEIDUNGEN", 'zh-CN': "从信号到决策", 'fr-FR': "DES SIGNAUX AUX DÉCISIONS", 'ja-JP': "兆候から意思決定へ" },
  "Turn delivery signals into accountable reviews": { 'ar-SA': "حوّل الانحرافات إلى مراجعة موثقة", 'de-DE': "Umsetzungssignale in nachvollziehbare Prüfungen überführen", 'zh-CN': "将交付信号转化为可追责的审查", 'fr-FR': "Transformer les signaux d’exécution en examens responsables", 'ja-JP': "実行状況の兆候を責任あるレビューへ" },
  "These are the current workspace API signals, not automated decisions or approvals.": { 'ar-SA': "بيانات مساحة العمل الحالية فقط. الأرقام المعروضة لا تعني اعتماد قرار أو تنفيذ إجراء.", 'de-DE': "Dies sind API-Signale des aktuellen Arbeitsbereichs, keine automatisierten Entscheidungen oder Genehmigungen.", 'zh-CN': "这些是当前工作区的 API 信号，并非自动决策或审批。", 'fr-FR': "Ces signaux proviennent de l’API de l’espace de travail actuel ; ils ne constituent ni décisions ni approbations automatisées.", 'ja-JP': "これは現在のワークスペースのAPI情報であり、自動的な意思決定や承認ではありません。" },
  "OBSERVE": { 'ar-SA': "رصد", 'de-DE': "BEOBACHTEN", 'zh-CN': "观察", 'fr-FR': "OBSERVER", 'ja-JP': "観察" },
  "Overdue register items": { 'ar-SA': "عناصر سجل متأخرة", 'de-DE': "Überfällige Registereinträge", 'zh-CN': "逾期登记事项", 'fr-FR': "Éléments de registre en retard", 'ja-JP': "期限超過の台帳項目" },
  "VERIFY": { 'ar-SA': "تحقق", 'de-DE': "PRÜFEN", 'zh-CN': "核实", 'fr-FR': "VÉRIFIER", 'ja-JP': "確認" },
  "Blocked gates needing evidence review": { 'ar-SA': "بوابات متعثرة تتطلب التحقق من الأدلة", 'de-DE': "Blockierte Phasengates mit Nachweisprüfung", 'zh-CN': "需要核查证据的受阻阶段关卡", 'fr-FR': "Jalons bloqués nécessitant une revue des preuves", 'ja-JP': "証拠確認が必要なブロック中のゲート" },
  "HUMAN DECISION": { 'ar-SA': "قرار بشري", 'de-DE': "MENSCHLICHE ENTSCHEIDUNG", 'zh-CN': "人工决策", 'fr-FR': "DÉCISION HUMAINE", 'ja-JP': "人による判断" },
  "Projects returned in the attention queue": { 'ar-SA': "مشاريع ضمن قائمة الانتباه المسترجعة", 'de-DE': "Projekte in der Aufmerksamkeitsliste", 'zh-CN': "待关注队列中返回的项目", 'fr-FR': "Projets figurant dans la file d’attention", 'ja-JP': "要対応キューに返されたプロジェクト" },
  "Check the source evidence and accountable owner before acting.": { 'ar-SA': "يجب مراجعة السجل الأصلي وصاحب الصلاحية قبل اتخاذ القرار.", 'de-DE': "Vor Maßnahmen die Originalnachweise und die verantwortliche Person prüfen.", 'zh-CN': "采取行动前，请核对原始证据及责任人。", 'fr-FR': "Vérifiez les justificatifs d’origine et le responsable avant d’agir.", 'ja-JP': "対応前に元の証拠と責任者を確認してください。" },
  "Delivery trend": { 'ar-SA': "اتجاه التنفيذ", 'de-DE': "Umsetzungstrend", 'zh-CN': "交付趋势", 'fr-FR': "Tendance de livraison", 'ja-JP': "実行傾向" },
  "Portfolio performance": { 'ar-SA': "أداء المحفظة", 'de-DE': "Portfolioleistung", 'zh-CN': "项目组合绩效", 'fr-FR': "Performance du portefeuille", 'ja-JP': "ポートフォリオ実績" },
  "Portfolio mix": { 'ar-SA': "توزيع المحفظة", 'de-DE': "Portfoliozusammensetzung", 'zh-CN': "项目组合构成", 'fr-FR': "Composition du portefeuille", 'ja-JP': "ポートフォリオ構成" },
  "Project health": { 'ar-SA': "حالة المشاريع", 'de-DE': "Projektstatus", 'zh-CN': "项目健康状况", 'fr-FR': "Santé des projets", 'ja-JP': "プロジェクトの健全性" },
  "Showing the first {shown} of {total} projects needing review.": { 'ar-SA': "عرض أول {shown} من أصل {total} مشروعًا يحتاج إلى مراجعة.", 'de-DE': "Die ersten {shown} von {total} Projekten mit Prüfbedarf werden angezeigt.", 'zh-CN': "显示需要审查的 {total} 个项目中的前 {shown} 个。", 'fr-FR': "Affichage des {shown} premiers projets sur {total} nécessitant un examen.", 'ja-JP': "要確認のプロジェクト {total} 件のうち最初の {shown} 件を表示しています。" },
  "Cumulative, by month": { 'ar-SA': "تراكمي، حسب الشهر", 'de-DE': "Kumuliert, nach Monat", 'zh-CN': "按月累计", 'fr-FR': "Cumulé, par mois", 'ja-JP': "月別累計" },
  'Skip to content': { 'de-DE': 'Zum Inhalt springen', 'zh-CN': '跳转到内容', 'fr-FR': 'Aller au contenu', 'ja-JP': '本文へスキップ' },
  'Modules': { 'de-DE': 'Module', 'zh-CN': '模块', 'fr-FR': 'Modules', 'ja-JP': 'モジュール'  , 'ur': "ماڈیولز" , 'es': "Módulos", 'es-419': "Módulos" , 'pt-BR': "Módulos", 'pt-PT': "Módulos", 'it': "Moduli", 'tr': "Modüller", 'ru': "Модули" , 'bn': "মডিউলসমূহ", 'fil': "Mga module", 'hi': "मॉड्यूल", 'id': "Modul", 'ko': "모듈", 'sw': "Moduli", 'vi': "Mô-đun", 'zh-TW': "模組" },
  'The EPMO': { 'de-DE': 'The EPMO', 'zh-CN': 'The EPMO', 'fr-FR': 'The EPMO', 'ja-JP': 'The EPMO' },
});

/**
 * English stays the source. Legacy Arabic is passed from existing NAV/controls
 * so this UI-only adapter never overwrites verified Arabic strings.
 */
/** Bridge historical six-locale catalog keys to TheOrg language identifiers. */
export function catalogLocale(locale) {
  return ({ ar:'ar-SA', de:'de-DE', fr:'fr-FR', ja:'ja-JP', 'en-US':'en', 'en-GB':'en' })[locale] ?? locale;
}
export function uiLabel(english, locale, legacyArabic = null) {
  locale = catalogLocale(locale);
  const row = Object.hasOwn(UI_LABELS, english) ? UI_LABELS[english] : null;
  if (locale === 'en') return english;
  // A legacy Arabic label is preferred where one exists, but a broken
  // translation must never drop or rename dynamic display placeholders.
  const candidate = locale === 'ar-SA'
    ? (typeof legacyArabic === 'string' && legacyArabic.trim() && legacyArabic !== english
      ? legacyArabic : row?.['ar-SA'])
    : row?.[locale];
  return typeof candidate === 'string' && candidate.trim() &&
    translationHasMatchingPlaceholders(english, candidate)
      ? candidate : english;
}

/** English text is the source. Placeholders must survive translation unchanged. */
export function translationPlaceholders(value) {
  return [...String(value).matchAll(/\{([a-zA-Z][\w]*)\}/g)]
    .map((match) => match[1]).sort();
}

export function translationHasMatchingPlaceholders(english, translated) {
  return JSON.stringify(translationPlaceholders(english)) ===
    JSON.stringify(translationPlaceholders(translated));
}

/**
 * Report verified catalog coverage; legacy Arabic fallback can be supplied as
 * a map of English source text to existing Arabic translations.
 * Do not count English fallback strings as translated.
 */
export function uiLabelCoverage(englishLabels, locale, legacyArabic = {}) {
  locale = catalogLocale(locale);
  const unique = [...new Set(englishLabels)];
  const missing = [];
  const invalidPlaceholders = [];
  for (const english of unique) {
    if (locale === 'en') continue;
    const row = Object.hasOwn(UI_LABELS, english) ? UI_LABELS[english] : null;
    const legacy = locale === 'ar-SA' && Object.hasOwn(legacyArabic, english)
      ? legacyArabic[english] : null;
    const translated = typeof legacy === 'string' && legacy.trim() && legacy !== english
      ? legacy : row?.[locale];
    if (typeof translated !== 'string' || !translated.trim() || translated === english) {
      // An English fallback is not proof of a completed translation.
      missing.push(english);
    } else if (!translationHasMatchingPlaceholders(english, translated)) {
      invalidPlaceholders.push(english);
    }
  }
  return { total: unique.length,
    translated: unique.length - missing.length - invalidPlaceholders.length,
    missing, invalidPlaceholders };
}
