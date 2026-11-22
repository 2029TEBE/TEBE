/**
 * Lightweight client-side feedback for common record-creation mistakes.
 * The API's Zod schemas and database constraints remain authoritative.
 * Returning message keys keeps UI copy localized without parsing server errors.
 */
import { normalizeFrontendLocale } from './frontend-locale.mjs';

const ERROR_TEXT = Object.freeze({
  invalid_project_code: { en: 'Use 2–16 letters, digits or hyphens.', ar: 'استخدم من ٢ إلى ١٦ حرفًا لاتينيًا أو رقمًا أو شرطة (-).' },
  invalid_date: { en: 'Enter a valid date.', ar: 'أدخل تاريخًا صحيحًا.' },
  end_before_start: { en: 'The finish date cannot be earlier than the start date.', ar: 'لا يمكن أن يكون تاريخ الانتهاء قبل تاريخ البدء.' },
  range_0_100: { en: 'Enter a whole number from 0 to 100.', ar: 'أدخل عددًا صحيحًا من ٠ إلى ١٠٠.' },
  range_1_100: { en: 'Enter a whole number from 1 to 100.', ar: 'أدخل عددًا صحيحًا من ١ إلى ١٠٠.' },
  range_1_5: { en: 'Enter a whole number from 1 to 5.', ar: 'أدخل عددًا صحيحًا من ١ إلى ٥.' },
  nonnegative: { en: 'Enter a number that is zero or greater.', ar: 'أدخل رقمًا يساوي صفرًا أو أكبر.' },
  finite_number: { en: 'Enter a valid number.', ar: 'أدخل رقمًا صحيحًا.' },
  currency: { en: 'Use a three-letter currency code such as SAR.', ar: 'استخدم رمز عملة من ثلاثة أحرف مثل SAR.' },
  required: { en: 'This field is required.', ar: 'هذا الحقل مطلوب.' },
  invalid: { en: 'Check this value and try again.', ar: 'تحقق من هذه القيمة ثم حاول مرة أخرى.' },
});
const EXTRA_ERROR_TEXT = Object.freeze({
  invalid_project_code: Object.freeze({"de":"Verwenden Sie 2–16 Buchstaben, Ziffern oder Bindestriche.","zh-CN":"请使用 2–16 个字母、数字或连字符。","fr":"Utilisez 2 à 16 lettres, chiffres ou tirets.","ja":"英字、数字、ハイフンを2～16文字使用してください。","bn":"২–১৬টি লাতিন অক্ষর, সংখ্যা বা হাইফেন ব্যবহার করুন।","es":"Use de 2 a 16 letras, números o guiones.","es-419":"Use de 2 a 16 letras, números o guiones.","fil":"Gumamit ng 2–16 titik, numero o gitling.","hi":"2–16 लैटिन अक्षर, अंक या हाइफ़न इस्तेमाल करें।","id":"Gunakan 2–16 huruf, angka atau tanda hubung.","it":"Usa 2–16 lettere, cifre o trattini.","ko":"영문자, 숫자 또는 하이픈 2~16자를 사용하세요.","pt-BR":"Use de 2 a 16 letras, dígitos ou hífens.","pt-PT":"Utilize 2 a 16 letras, algarismos ou hífenes.","ru":"Используйте 2–16 латинских букв, цифр или дефисов.","sw":"Tumia herufi 2–16 za Kilatini, tarakimu au vistari.","tr":"2–16 Latin harfi, rakam veya kısa çizgi kullanın.","ur":"2 سے 16 لاطینی حروف، ہندسے یا ہائفن استعمال کریں۔","vi":"Dùng 2–16 chữ cái Latinh, chữ số hoặc dấu gạch nối.","zh-TW":"請使用 2–16 個英文字母、數字或連字號。"}),
  invalid_date: Object.freeze({"de":"Geben Sie ein gültiges Datum ein.","zh-CN":"请输入有效日期。","fr":"Saisissez une date valide.","ja":"有効な日付を入力してください。","bn":"একটি বৈধ তারিখ লিখুন।","es":"Introduzca una fecha válida.","es-419":"Ingrese una fecha válida.","fil":"Maglagay ng wastong petsa.","hi":"मान्य तारीख दर्ज करें।","id":"Masukkan tanggal yang valid.","it":"Inserisci una data valida.","ko":"유효한 날짜를 입력하세요.","pt-BR":"Insira uma data válida.","pt-PT":"Introduza uma data válida.","ru":"Введите допустимую дату.","sw":"Weka tarehe halali.","tr":"Geçerli bir tarih girin.","ur":"درست تاریخ درج کریں۔","vi":"Nhập ngày hợp lệ.","zh-TW":"請輸入有效日期。"}),
  end_before_start: Object.freeze({"de":"Das Enddatum darf nicht vor dem Startdatum liegen.","zh-CN":"结束日期不能早于开始日期。","fr":"La date de fin ne peut pas précéder la date de début.","ja":"終了日は開始日より前にできません。","bn":"শেষের তারিখ শুরুর তারিখের আগে হতে পারে না।","es":"La fecha de fin no puede ser anterior a la de inicio.","es-419":"La fecha de finalización no puede ser anterior a la de inicio.","fil":"Hindi maaaring mauna ang petsa ng pagtatapos sa petsa ng pagsisimula.","hi":"समाप्ति की तारीख आरंभ की तारीख से पहले नहीं हो सकती।","id":"Tanggal selesai tidak boleh mendahului tanggal mulai.","it":"La data di fine non può precedere quella di inizio.","ko":"종료일은 시작일보다 빠를 수 없습니다.","pt-BR":"A data de término não pode ser anterior à data inicial.","pt-PT":"A data de fim não pode ser anterior à data de início.","ru":"Дата окончания не может быть раньше даты начала.","sw":"Tarehe ya mwisho haiwezi kutangulia tarehe ya kuanza.","tr":"Bitiş tarihi başlangıç tarihinden önce olamaz.","ur":"اختتامی تاریخ ابتدائی تاریخ سے پہلے نہیں ہو سکتی۔","vi":"Ngày kết thúc không thể trước ngày bắt đầu.","zh-TW":"結束日期不得早於開始日期。"}),
  nonnegative: Object.freeze({"de":"Geben Sie eine Zahl größer oder gleich null ein.","zh-CN":"请输入大于或等于零的数字。","fr":"Saisissez un nombre supérieur ou égal à zéro.","ja":"0以上の数値を入力してください。","bn":"শূন্য বা তার বেশি সংখ্যা লিখুন।","es":"Introduzca un número igual o superior a cero.","es-419":"Ingrese un número igual o mayor que cero.","fil":"Maglagay ng numerong zero o mas mataas.","hi":"शून्य या उससे बड़ी संख्या दर्ज करें।","id":"Masukkan angka nol atau lebih besar.","it":"Inserisci un numero maggiore o uguale a zero.","ko":"0 이상의 숫자를 입력하세요.","pt-BR":"Insira um número maior ou igual a zero.","pt-PT":"Introduza um número igual ou superior a zero.","ru":"Введите число не меньше нуля.","sw":"Weka nambari ya sifuri au zaidi.","tr":"Sıfır veya daha büyük bir sayı girin.","ur":"صفر یا اس سے بڑا عدد درج کریں۔","vi":"Nhập số lớn hơn hoặc bằng không.","zh-TW":"請輸入大於或等於零的數字。"}),
  finite_number: Object.freeze({"de":"Geben Sie eine gültige Zahl ein.","zh-CN":"请输入有效数字。","fr":"Saisissez un nombre valide.","ja":"有効な数値を入力してください。","bn":"একটি বৈধ সংখ্যা লিখুন।","es":"Introduzca un número válido.","es-419":"Ingrese un número válido.","fil":"Maglagay ng wastong numero.","hi":"मान्य संख्या दर्ज करें।","id":"Masukkan angka yang valid.","it":"Inserisci un numero valido.","ko":"유효한 숫자를 입력하세요.","pt-BR":"Insira um número válido.","pt-PT":"Introduza um número válido.","ru":"Введите допустимое число.","sw":"Weka nambari halali.","tr":"Geçerli bir sayı girin.","ur":"درست عدد درج کریں۔","vi":"Nhập số hợp lệ.","zh-TW":"請輸入有效數字。"}),
  currency: Object.freeze({"de":"Verwenden Sie einen dreibuchstabigen Währungscode wie SAR.","zh-CN":"请使用 SAR 等三字母货币代码。","fr":"Utilisez un code devise à trois lettres comme SAR.","ja":"SARなど3文字の通貨コードを使用してください。","bn":"SAR-এর মতো তিন অক্ষরের মুদ্রা কোড ব্যবহার করুন।","es":"Use un código de moneda de tres letras, como SAR.","es-419":"Use un código de moneda de tres letras, como SAR.","fil":"Gumamit ng tatlong titik na currency code gaya ng SAR.","hi":"SAR जैसा तीन अक्षरों वाला मुद्रा कोड इस्तेमाल करें।","id":"Gunakan kode mata uang tiga huruf seperti SAR.","it":"Usa un codice valuta di tre lettere come SAR.","ko":"SAR와 같은 세 글자 통화 코드를 사용하세요.","pt-BR":"Use um código de moeda de três letras, como SAR.","pt-PT":"Utilize um código de moeda de três letras, como SAR.","ru":"Используйте трёхбуквенный код валюты, например SAR.","sw":"Tumia msimbo wa sarafu wa herufi tatu kama SAR.","tr":"SAR gibi üç harfli para birimi kodu kullanın.","ur":"SAR جیسا تین حرفی کرنسی کوڈ استعمال کریں۔","vi":"Dùng mã tiền tệ ba chữ cái như SAR.","zh-TW":"請使用 SAR 等三個字母的貨幣代碼。"}),
  required: Object.freeze({"de":"Dieses Feld ist erforderlich.","zh-CN":"此字段为必填项。","fr":"Ce champ est obligatoire.","ja":"この項目は必須です。","bn":"এই ক্ষেত্রটি আবশ্যক।","es":"Este campo es obligatorio.","es-419":"Este campo es obligatorio.","fil":"Kinakailangan ang field na ito.","hi":"यह फ़ील्ड आवश्यक है।","id":"Kolom ini wajib diisi.","it":"Questo campo è obbligatorio.","ko":"필수 입력 항목입니다.","pt-BR":"Este campo é obrigatório.","pt-PT":"Este campo é obrigatório.","ru":"Это обязательное поле.","sw":"Sehemu hii inahitajika.","tr":"Bu alan zorunludur.","ur":"یہ خانہ ضروری ہے۔","vi":"Trường này là bắt buộc.","zh-TW":"此欄位為必填。"}),
  invalid: Object.freeze({"de":"Überprüfen Sie diesen Wert und versuchen Sie es erneut.","zh-CN":"请检查此值并重试。","fr":"Vérifiez cette valeur et réessayez.","ja":"値を確認して再試行してください。","bn":"মানটি যাচাই করে আবার চেষ্টা করুন।","es":"Compruebe este valor e inténtelo de nuevo.","es-419":"Verifique este valor e inténtelo de nuevo.","fil":"Suriin ang halagang ito at subukang muli.","hi":"इस मान की जाँच करें और फिर कोशिश करें।","id":"Periksa nilai ini dan coba lagi.","it":"Controlla questo valore e riprova.","ko":"이 값을 확인하고 다시 시도하세요.","pt-BR":"Verifique este valor e tente novamente.","pt-PT":"Verifique este valor e tente novamente.","ru":"Проверьте значение и повторите попытку.","sw":"Kagua thamani hii na ujaribu tena.","tr":"Bu değeri kontrol edip tekrar deneyin.","ur":"اس قدر کو چیک کریں اور دوبارہ کوشش کریں۔","vi":"Kiểm tra giá trị này rồi thử lại.","zh-TW":"請檢查此值並重試。"}),
  range_0_100: Object.freeze({"de":"Geben Sie eine ganze Zahl von 0 bis 100 ein.","zh-CN":"请输入 0 到 100 之间的整数。","fr":"Saisissez un nombre entier de 0 à 100.","ja":"0～100の整数を入力してください。","bn":"0 থেকে 100 পর্যন্ত একটি পূর্ণসংখ্যা লিখুন।","es":"Introduzca un número entero de 0 a 100.","es-419":"Ingrese un número entero de 0 a 100.","fil":"Maglagay ng buong numero mula 0 hanggang 100.","hi":"0 से 100 तक की पूर्ण संख्या दर्ज करें।","id":"Masukkan bilangan bulat dari 0 hingga 100.","it":"Inserisci un numero intero da 0 a 100.","ko":"0~100 사이의 정수를 입력하세요.","pt-BR":"Insira um número inteiro de 0 a 100.","pt-PT":"Introduza um número inteiro de 0 a 100.","ru":"Введите целое число от 0 до 100.","sw":"Weka nambari kamili kuanzia 0 hadi 100.","tr":"0 ile 100 arasında bir tam sayı girin.","ur":"0 سے 100 تک صحیح عدد درج کریں۔","vi":"Nhập số nguyên từ 0 đến 100.","zh-TW":"請輸入 0 到 100 之間的整數。"}),
  range_1_100: Object.freeze({"de":"Geben Sie eine ganze Zahl von 1 bis 100 ein.","zh-CN":"请输入 1 到 100 之间的整数。","fr":"Saisissez un nombre entier de 1 à 100.","ja":"1～100の整数を入力してください。","bn":"1 থেকে 100 পর্যন্ত একটি পূর্ণসংখ্যা লিখুন।","es":"Introduzca un número entero de 1 a 100.","es-419":"Ingrese un número entero de 1 a 100.","fil":"Maglagay ng buong numero mula 1 hanggang 100.","hi":"1 से 100 तक की पूर्ण संख्या दर्ज करें।","id":"Masukkan bilangan bulat dari 1 hingga 100.","it":"Inserisci un numero intero da 1 a 100.","ko":"1~100 사이의 정수를 입력하세요.","pt-BR":"Insira um número inteiro de 1 a 100.","pt-PT":"Introduza um número inteiro de 1 a 100.","ru":"Введите целое число от 1 до 100.","sw":"Weka nambari kamili kuanzia 1 hadi 100.","tr":"1 ile 100 arasında bir tam sayı girin.","ur":"1 سے 100 تک صحیح عدد درج کریں۔","vi":"Nhập số nguyên từ 1 đến 100.","zh-TW":"請輸入 1 到 100 之間的整數。"}),
  range_1_5: Object.freeze({"de":"Geben Sie eine ganze Zahl von 1 bis 5 ein.","zh-CN":"请输入 1 到 5 之间的整数。","fr":"Saisissez un nombre entier de 1 à 5.","ja":"1～5の整数を入力してください。","bn":"1 থেকে 5 পর্যন্ত একটি পূর্ণসংখ্যা লিখুন।","es":"Introduzca un número entero de 1 a 5.","es-419":"Ingrese un número entero de 1 a 5.","fil":"Maglagay ng buong numero mula 1 hanggang 5.","hi":"1 से 5 तक की पूर्ण संख्या दर्ज करें।","id":"Masukkan bilangan bulat dari 1 hingga 5.","it":"Inserisci un numero intero da 1 a 5.","ko":"1~5 사이의 정수를 입력하세요.","pt-BR":"Insira um número inteiro de 1 a 5.","pt-PT":"Introduza um número inteiro de 1 a 5.","ru":"Введите целое число от 1 до 5.","sw":"Weka nambari kamili kuanzia 1 hadi 5.","tr":"1 ile 5 arasında bir tam sayı girin.","ur":"1 سے 5 تک صحیح عدد درج کریں۔","vi":"Nhập số nguyên từ 1 đến 5.","zh-TW":"請輸入 1 到 5 之間的整數。"}),
});
export function formErrorText(code, lang = 'en') {
  const key = Object.hasOwn(ERROR_TEXT, code) ? code : 'invalid';
  const locale = normalizeFrontendLocale(lang);
  return EXTRA_ERROR_TEXT[key]?.[locale] ?? ERROR_TEXT[key][locale === 'ar' ? 'ar' : 'en'];
}
const validDay = s => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const date = new Date(`${s}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === s;
};
const numberIn = (s, min, max) => s === '' || (Number.isFinite(Number(s)) && Number.isInteger(Number(s)) && Number(s) >= min && Number(s) <= max);
const safeNumber = s => s === '' || (Number.isFinite(Number(s)) && Number(s) >= 0);

/** @returns {Record<string, string>} field -> error message key */
export function validateCreateForm(kind, values) {
  const errors = {};
  const get = field => String(values[field] ?? '').trim();
  const dates = (startField, endField) => {
    const start = get(startField), end = get(endField);
    if (start && !validDay(start)) errors[startField] = 'invalid_date';
    if (end && !validDay(end)) errors[endField] = 'invalid_date';
    if (start && end && validDay(start) && validDay(end) && end < start) errors[endField] = 'end_before_start';
  };
  if (kind === 'project') {
    if (get('code') && !/^[A-Za-z0-9-]{2,16}$/.test(get('code'))) errors.code = 'invalid_project_code';
    dates('startDate', 'endDate');
    if (!safeNumber(get('budgetAmount'))) errors.budgetAmount = 'nonnegative';
  } else if (kind === 'schedule-item') {
    dates('startDate', 'endDate');
    dates('baselineStart', 'baselineEnd');
    if (!numberIn(get('progressPct'), 0, 100)) errors.progressPct = 'range_0_100';
  } else if (kind === 'allocation') {
    dates('startDate', 'endDate');
    if (!numberIn(get('allocationPct'), 1, 100) || get('allocationPct') === '') errors.allocationPct = 'range_1_100';
  } else if (kind === 'raid' || kind === 'stakeholder') {
    for (const field of kind === 'raid' ? ['severity', 'likelihood'] : ['influence', 'interest']) {
      if (!numberIn(get(field), 1, 5)) errors[field] = 'range_1_5';
    }
  } else if (kind === 'cost') {
    if (get('amount') && !Number.isFinite(Number(get('amount')))) errors.amount = 'finite_number';
    if (get('currency') && !/^[A-Za-z]{3}$/.test(get('currency'))) errors.currency = 'currency';
  }
  return errors;
}
