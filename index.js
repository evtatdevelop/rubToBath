const readline = require('readline');
const cc = require("node-console-colors");
const fs = require('fs');
const request = require('request');
const cheerio = require('cheerio');

const getInterest = readline.createInterface({input: process.stdin, output: process.stdout});

const moneyFormat = (num, curr=null) => {
  symbols = {'rub': '₽', 'cny': '¥ ', 'usd': '$  ', 'thb': '฿'};
  return `${curr ? symbols[curr] : ''} ${Math.floor(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")}`
};

const {bathIsThere, thaiMonth, rublesIsThere, condoMonthRent, borderRunPrice, stayingMonth, parseHourPeriod} = require('./config.json');
console.log(`\nBath is there:    ${cc.set('fg_yellow', moneyFormat(bathIsThere))}`);
console.log(`Condo month rent: ${cc.set('fg_yellow', moneyFormat(condoMonthRent))}`);
console.log(`Border run price: ${cc.set('fg_yellow', moneyFormat(borderRunPrice))}`);
console.log(`Staying month:     ${cc.set('fg_yellow', stayingMonth)}`);

getInterest.question(`\nMonth expenses in Thai, THB (${moneyFormat(thaiMonth)} ): `, thai_month => 
  getInterest.question(`How much RUB is there (${moneyFormat(rublesIsThere)} ): `, rubles => {
    if ( !thai_month ) thai_month = thaiMonth;
    if ( !rubles ) rubles = rublesIsThere;
    getStat( thai_month, rubles );
    getInterest.close();
  })
);

const getStat = (thai_month, rubles) => fs.exists('./stat.json', exists => {
  if ( exists ) fs.readFile('./stat.json', (err, data) => {  
    const stat = JSON.parse(data);
    const lastStat = Object.entries(stat)[Object.entries(stat).length-1];
    if ( lastStat && lastStat[0] ) console.log(`\nLatest rate update: ${cc.set('fg_blue', new Date(+lastStat[0]))}`);
    if ( !lastStat || !lastStat[0] || Date.now() - +lastStat[0] > parseHourPeriod*3600*1000) parseRates( thai_month, rubles );
    else showResults( {...lastStat[1], thai_month, rubles} );
  })
})

const parseRates = ( thai_month, rubles ) => {
  request('https://pattaya-city.ru/banki/kurs', (err, response, html) => {
    if ( !err && response.statusCode === 200 ) {
      const { bath_usd, bath_cny, bath_rub } = pattayaCityRu(html);
      request('https://www.atb.su/services/exchange/', (err, response, html) => {
        if ( !err && response.statusCode === 200 ) {
          const { cny_rub, usd_rub } = atbSu(html);
          saveStat( { [Date.now()]: { bath_usd, bath_cny, bath_rub, cny_rub, usd_rub, }, } );
          showResults( {bath_usd, bath_cny, bath_rub, cny_rub, usd_rub, thai_month, rubles} );
        }  
      });
    }
  })
}

const saveStat = addStat => fs.exists('./stat.json', exists => {
  if ( exists ) fs.readFile('./stat.json', (err, data) => {  
    const stat = JSON.parse(data);
    const saveStat = {...stat, ...addStat};
    fs.writeFile('./stat.json', JSON.stringify(saveStat), (err) => {
     if ( err ) console.error(err);
    })
  })
})

const showResults = dataRates => {
  const {bath_usd, bath_cny, bath_rub, cny_rub, usd_rub, thai_month, rubles } = dataRates;
  const yuan = rubles / cny_rub;
  const dollars = rubles / usd_rub;
  const rubToBath = bath_rub * rubles;
  const cnyToBath = bath_cny * yuan;
  const usdToBath = bath_usd * dollars;
  const baths = val => cc.set(  Math.max(rubToBath, cnyToBath, usdToBath) === val  ? 'fg_green' : 'fg_cyan', moneyFormat(val, 'thb') );
  const stay = val => cc.set('fg_yellow', Math.floor((val + bathIsThere) / thai_month) + ' month')
  console.log('');
  console.log(`RUB - ${moneyFormat(rubles, 'rub')} - ${baths(rubToBath)} (${stay(rubToBath)})`);
  console.log(`CNY - ${moneyFormat(yuan, 'cny')} - ${baths(cnyToBath)} (${stay(cnyToBath)})`);
  console.log(`USD - ${moneyFormat(dollars, 'usd')} - ${baths(usdToBath)} (${stay(usdToBath)})`);
  const weekExpss = (val) =>  Math.floor((val + bathIsThere - condoMonthRent * stayingMonth - borderRunPrice * (stayingMonth / 1.5)) / (181 / 7) )
  console.log(`\n${ moneyFormat(Math.round((weekExpss(rubToBath) + weekExpss(cnyToBath) + weekExpss(usdToBath)) / 3), 'thb') } a week`);  
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
  const $ = cheerio.load(html);          
  cny_rub = parseFloat($('#currencyTab1').find('.currency-table').find('.currency-table__tr').eq(1).find('.currency-table__td').eq(2).text());
  usd_rub = parseFloat($('#currencyTab1').find('.currency-table').find('.currency-table__tr').eq(2).find('.currency-table__td').eq(2).text());
  return {cny_rub, usd_rub}
}
