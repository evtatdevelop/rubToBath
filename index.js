const readline = require('readline');
const cc = require("node-console-colors");
const fs = require('fs');
const request = require('request');
const cheerio = require('cheerio');

const bath = 9956;

const getInterest = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

getInterest.question('Month expenses in Thai, THB (20 000)? ', (thai_month) => 
  getInterest.question(`How much RUB is there (300 000)? `, (money) => {
    if ( thai_month && money ) parseRates( thai_month, money );
    else parseRates( 20000, 300000 );
    getInterest.close();
  })
);

const moneyFormat = (num, curr) => {
  symbols = {'rub': '₽', 'cny': '¥ ', 'usd': '$  ', 'thb': '฿'};
  return `${symbols[curr]} ${Math.floor(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")}`
};

const parseRates = ( thai_month, rubles ) => {
  request('https://pattaya-city.ru/banki/kurs', (err, response, html) => {
    if ( !err && response.statusCode === 200 ) {
      const { bath_usd, bath_cny, bath_rub } = pattayaCityRu(html);

      request('https://www.atb.su/services/exchange/', (err, response, html) => {
        if ( !err && response.statusCode === 200 ) {
          const { cny_rub, usd_rub } = atbSu(html);

          const yuan = rubles / cny_rub;
          const dollars = rubles / usd_rub;;
          const rubToBath = bath_rub * rubles;
          const cnyToBath = bath_cny * yuan;
          const usdToBath = bath_usd * dollars;
          const baths = val => cc.set(  Math.max(rubToBath, cnyToBath, usdToBath) === val  ? 'fg_green' : 'fg_cyan', moneyFormat(val, 'thb') );
          const stay = val => cc.set('fg_yellow', Math.floor((val + bath) / thai_month) + ' month')
          console.log('');
          console.log(`RUB - ${moneyFormat(rubles, 'rub')} - ${baths(rubToBath)} (${stay(rubToBath)})`);
          console.log(`CNY - ${moneyFormat(yuan, 'cny')} - ${baths(cnyToBath)} (${stay(cnyToBath)})`);
          console.log(`USD - ${moneyFormat(dollars, 'usd')} - ${baths(usdToBath)} (${stay(usdToBath)})`);
        }  
      });
    }
  })
}

const pattayaCityRu = html => {
  const $ = cheerio.load(html);
  const bath_usd = parseFloat($('#toc-2').parent('h2').next('p').next('div').find('.widget')
    .find('.currencyconverter-minimalistic-container')
    .find('.currencyconverter-minimalistic-single-currency')
    .find('.currencyconverter-minimalistic-row')
    .find('.currencyconverter-minimalistic-currency-price').text().replace(',', '.'));
  const bath_cny = parseFloat($('.widget_currencyconverter_table').eq(0).find('table')
    .find('tbody').find('tr').eq(5).find('td').eq(1).find('span').text().replace(',', '.'));
  const bath_rub = parseFloat($('#toc').parent('h2').next('p').next('div').find('.widget')
    .find('.currencyconverter-minimalistic-container')
    .find('.currencyconverter-minimalistic-single-currency')
    .find('.currencyconverter-minimalistic-row')
    .find('.currencyconverter-minimalistic-currency-price').text().replace(',', '.'));
  return {bath_usd, bath_cny, bath_rub}
}

const atbSu = html => {
  let cny_rub_arch = 13.17;
  let usd_rub_arch = 94.38;
  const $ = cheerio.load(html);          
  cny_rub = parseFloat($('#currencyTab1').find('.currency-table').find('.currency-table__tr').eq(1).find('.currency-table__td').eq(2).text()) || cny_rub_arch;
  usd_rub = parseFloat($('#currencyTab1').find('.currency-table').find('.currency-table__tr').eq(2).find('.currency-table__td').eq(2).text()) || usd_rub_arch;
  return {cny_rub, usd_rub}
}
