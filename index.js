const { Telegraf } = require('telegraf');
const puppeteer = require('puppeteer');
const cron = require('node-cron');

const bot = new Telegraf('6862658398:AAHbeLrSSyUqtBnIDJfCtFtK7tDgSsWgb-M');
const updateInterval = '0 */1 * * * '; // Cron expression for every 2 minutes

bot.start((ctx) => ctx.reply('Привет! Введите код для отслеживания посылки.'));

let previousStatus = null; // Добавляем переменную для хранения предыдущего статуса

const getPackageInfo = async (ctx) => {
  const trackCode = ctx.message.text;
  const trackUrl = `https://track24.ru/?code=${trackCode}`;

  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto(trackUrl);
  await page.waitForTimeout(5000);

  const operationText = await page.evaluate(() => {
    const elements = document.querySelectorAll('.operationAttribute');
    const lastElement = elements[elements.length - 1];
    return lastElement ? lastElement.textContent.trim() : null;
  });

  const dateTimeInfo = await page.evaluate(() => {
    const elements = document.querySelectorAll('.trackingInfoDateTime');
    const lastElement = elements[elements.length - 1];

    if (lastElement) {
      const date = lastElement.querySelector('.date b').textContent.trim();
      const time = lastElement.querySelector('.time').textContent.trim();
      return { date, time };
    } else {
      return null;
    }
  });

  let replyMessage = 'Информация о посылке:\n\n';

  if (operationText) {
    replyMessage += `Статус: ${operationText}\n\n`;

    // Проверяем изменение статуса
    if (previousStatus !== null && previousStatus !== operationText) {
      ctx.reply('Статус посылки изменился!');
    }

    // Сохраняем текущий статус
    previousStatus = operationText;
  } else {
    replyMessage +=
      'Информация о последнем элементе (operationAttribute) не найдена.\n\n';
  }

  if (dateTimeInfo) {
    replyMessage += `Дата: ${dateTimeInfo.date}\n`;
    replyMessage += `Время: ${dateTimeInfo.time}\n`;
  } else {
    replyMessage +=
      'Информация о дате и времени (trackingInfoDateTime) не найдена.';
  }

  ctx.reply(replyMessage);

  await browser.close();
};

bot.on('text', async (ctx) => {
  // Run the initial package info retrieval
  await getPackageInfo(ctx);

  // Schedule periodic updates using node-cron
  const cronJob = cron.schedule(updateInterval, async () => {
    await getPackageInfo(ctx);
  });

  // Save the cron job for later cleanup
  ctx.cronJob = cronJob;
});

bot.launch();
