const Telebot = require('node-telegram-bot-api')
const fetch = require('node-fetch')
const { server } = require('./config/config')
const options = require('./options/options')
const https = require('https')
const fs = require('fs')
const jsdom = require("jsdom")
const { JSDOM } = jsdom
const MP3Cutter = require('mp3-cutter')
const mp3Duration = require('mp3-duration')
const express = require('express')
const app = express()
const CronJob = require('cron').CronJob
const upload = require('express-fileupload')
const { v4 } = require('uuid')
const util = require('util')
const cors = require("cors")
require('dotenv').config()

const readFile = util.promisify(fs.readFile)

const bot = new Telebot(process.env.token, {
  polling: true
})

app.use(cors({ origin: "*" }))
app.use(express.json())
app.use(express.urlencoded({ extended: false }))
app.use(upload())

// server

app.post('/question/response', async (req, res) => {
  const { chatId, resText, userQuestion } = req.body
  const outputMessage = `Sizning savolingiz:\n\n${userQuestion}\n\nJavob:\n\n${resText}`
  await bot.sendMessage(Number(chatId), outputMessage)
  await fetch(`${server}/setquestion`, {
    method: "POST",
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ user_tg_id: Number(chatId) })
  })
  res.send({ status: 200 }).end()
})

app.post('/post', async (req, res) => {
  try {
    const { msgId, gender, profession, age, regions } = req.body
    const data = await fetch(`${server}/getbyquery`, {
      method: "POST",
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ gender, profession: JSON.parse(profession), age: JSON.parse(age), regions: JSON.parse(regions) })
    })
    const users = await data.json()
    const job = new CronJob('0/1 * * * * *', function () {
      const current = users.splice(0, 20)
      current.forEach(async user => {
        await bot.forwardMessage(Number(user.user_tg_id), process.env.channel, Number(msgId))
      })
    }, null, true)
    job.start()
    res.status(200).end()
  } catch (error) {
    console.error(error)
  }
})

app.listen(4000, () => console.log(4000))

// generate videos list

async function generateVideosList(tgBot, chatId, msgId) {
  await fetch(`${server}/step`, {
    method: "PUT",
    headers: {
      "Content-type": 'application/json; charset=UTF-8',
    },
    body: JSON.stringify({ user_tg_id: chatId, user_step: 'videos' })
  })
  let outputMessage = ""
  const data = await fetch(`${server}/video`)
  const json = await data.json()
  const videosKeyboard = []
  for (let i = 0; i < json.length; i++) {
    outputMessage += (json[i].id + '.' + ' ') + (await json[i].title) + '\n\n'
      ; (videosKeyboard.length ? (videosKeyboard[0].length === 5) ? videosKeyboard.unshift([{ text: json[i].id, callback_data: json[i].videoId }]) : videosKeyboard[0].push({ text: json[i].id, callback_data: json[i].videoId }) : videosKeyboard.push([{ text: json[i].id, callback_data: json[i].videoId }]))
  }
  videosKeyboard.unshift([{ text: '⬅️ Orqaga', callback_data: "videos_back" }])
  await tgBot.sendChatAction(chatId, "typing")
  await tgBot.deleteMessage(chatId, msgId)
  await tgBot.sendMessage(chatId, outputMessage, {
    reply_markup: {
      inline_keyboard: videosKeyboard.reverse()
    }
  })
}

// generate video

async function generateVideo(tgBot, chatId, msgId, cbData) {
  const data = await fetch(`${server}/video`, {
    method: "POST",
    headers: {
      "Content-type": 'application/json; charset=UTF-8',
    },
    body: JSON.stringify({ videoId: cbData })
  })

  const json = await data.json()

  const link = await json.link
  const title = await json.title
  const img = await json.imgUrl
  const notBroadcast = await json.broadcast

  if (notBroadcast) {
    await tgBot.deleteMessage(chatId, msgId)
    await tgBot.sendChatAction(chatId, "typing")
    await tgBot.sendPhoto(chatId, img, {
      caption: title,
      reply_markup: {
        inline_keyboard: [
          [
            { text: '⬅️ Orqaga', callback_data: 'video_back' },
            { text: "Ta'rif", callback_data: `video_desc_${cbData}` },
            { text: "Havola", url: link }
          ],
          [{ text: 'Podcast 🎙', callback_data: `video_podcast_${cbData}` }]
        ]
      }
    })
  } else {
    await tgBot.deleteMessage(chatId, msgId)
    await tgBot.sendChatAction(chatId, "typing")
    await tgBot.sendPhoto(chatId, img, {
      caption: (title + '\n\n <b>Tez orada primyera 🔔</>'),
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            { text: '⬅️ Orqaga', callback_data: 'video_back' },
            { text: "Ta'rif", callback_data: `video_desc_${cbData}` },
            { text: "Havola", url: link }
          ]
        ]
      }
    })
  }
}

// send data and update step

async function sendDataAndUpdateStep(endpoint, method, chatId, nextStep, colName, value) {
  await fetch(`${server}/${endpoint}`, {
    method: method,
    headers: {
      "Content-type": 'application/json; charset=UTF-8',
    },
    body: JSON.stringify({ user_tg_id: chatId, user_step: nextStep, key: colName, value: value })
  })
}

// update only step

async function updateStep(chatId, newStep) {
  await fetch(`${server}/step`, {
    method: "PUT",
    headers: {
      "Content-type": 'application/json; charset=UTF-8',
    },
    body: JSON.stringify({ user_tg_id: chatId, user_step: newStep })
  })
}

// delete and send chat action

async function deleteAndSendChatAction(tgBot, chatId, msgId, action) {
  await tgBot.sendChatAction(chatId, action)
  await tgBot.deleteMessage(chatId, msgId)
}

// get user info

async function getUserInfo(chatId) {
  const data = await fetch(`${server}/user?user_tg_id=${chatId}`)
  return await data.json()
}

// on text

bot.onText(/\/start/, async (message) => {
  const chatId = message.chat.id
  try {
    if (Boolean(message.text.split('/start')[1])) {
      const sharer = Number(message.text.split('/start')[1].trim())
      const data = await fetch(`${server}/user`, {
        method: "POST",
        headers: {
          "Content-type": 'application/json; charset=UTF-8',
        },
        body: JSON.stringify({ user_tg_id: sharer })
      })
      const json = await data.json()
      if (json.isUser) {
        if (sharer == chatId) {
          await bot.sendMessage(chatId, "O'zingizga o'zingiz jo'nata olmaysiz")
        } else {
          const data = await fetch(`${server}/user`, {
            method: "POST",
            headers: {
              "Content-type": 'application/json; charset=UTF-8',
            },
            body: JSON.stringify({ user_tg_id: chatId })
          })
          const json = await data.json()
          if (json.isUser) {
            await bot.sendMessage(sharer, "Bu inson allaqachon botda mavjud ekan")
          } else {
            await fetch(`${server}/preusers`, {
              method: "POST",
              body: JSON.stringify({ sharer_id: sharer, joiner_id: chatId }),
              headers: {
                "Content-type": 'application/json; charset=UTF-8',
              },
            })
          }
        }
      }
    }

    const data = await fetch(`${server}/user`, {
      method: "POST",
      headers: {
        "Content-type": 'application/json; charset=UTF-8',
      },
      body: JSON.stringify({ user_tg_id: chatId })
    })
    const json = await data.json()
    if (!json.isUser) {
      const data = await fetch(`${server}/register`, {
        method: "POST",
        headers: {
          "Content-type": 'application/json; charset=UTF-8',
        },
        body: JSON.stringify({ user_tg_id: chatId, user_step: 'first_name' })
      })
      await bot.sendMessage(chatId, '<b>"Osmondagi bolalar"</b> loyihasining rasmiy bot xizmatiga xush kelibsiz! \n\nIsmingizni kiriting.', {
        parse_mode: "HTML"
      })
    } else {
      const data = await fetch(`${server}/step`, {
        method: "POST",
        headers: {
          "Content-type": 'application/json; charset=UTF-8',
        },
        body: JSON.stringify({ user_tg_id: chatId })
      })
      const { user_step: userStep } = await data.json()
      if (userStep === 'first_name') {
        await bot.sendMessage(chatId, '<b>"Osmondagi bolalar"</b> loyihasining rasmiy bot xizmatiga xush kelibsiz! \n\nIsmingizni kiriting.', {
          parse_mode: "HTML"
        })
      } else if (userStep === 'last_name') {
        const user = await getUserInfo(chatId)
        await bot.sendMessage(chatId, `<b>${user.user_name}</b> familiyangizni kiriting!`, { parse_mode: "HTML" })
      } else if (userStep === 'user_birth') {
        const user = await getUserInfo(chatId)
        await bot.sendMessage(chatId, `<b>${user.user_name + ' ' + user.user_surname}</b> tug'ilgan yilingizni kiriting! \n\nMisol uchun: (2000)`, { parse_mode: "HTML" })
      } else if (userStep === 'gender') {
        await bot.sendMessage(chatId, 'Jinsingiz:', options.genderKeyboard)
      } else if (userStep === 'region') {
        await bot.sendMessage(chatId, "Qaysi viloyatda istiqomat qilasiz?", options.regionsKeyboard)
      } else if (userStep === 'profession') {
        await bot.sendMessage(chatId, "Qanday kasbda faoliyat yuritasiz?", options.professionKeyboard)
      } else {
        await updateStep(chatId, 0)

        let msgText = ''
        msgText += '🚀 <b>"Osmondagi bolalar"</b> — hayotning past-u balandiga qaramasdan o‘z shijoat-g‘ayrati bilan yuqori marralarni zabt eta olgan, yoshlarga chinakam motivatsiya rolini bajarib beradigan insonlarni samimiy suhbat orqali o‘zida jam qilgan yangi, interaktiv ko‘rsatuv.'
        msgText += '\n\nLoyihaning aktual missiyasi katta natijalarni qo‘lga kiritgan yoshlarni ommaga tanitish va ularni bu yo‘ldagi xato, qiyinchiliklar, to‘plangan tajribalarini jamiyat bilan bo‘lishishdan iborat!'
        msgText += `\n\n💪 Ushbu botda siz loyiha haqidagi eng <b>so'nggi</b> <b>yangiliklardan</b> xabardor bo'lishingiz, istalgan suhbatning <b>audio</b> shaklini yuklab olishingiz, loyiha bo'yicha o'z <b>takliflaringizni</b> yo'llashingiz, qolaversa, turli xil <b>ajoyib</b> <b>sovg'alarni</b> qo'lga kiritishingiz mumkin`

        await bot.sendMessage(chatId, msgText, options.defaultMenu)
      }
    }
  } catch (error) {
    console.error(error)
  }
})

// on message

bot.on('message', async (message) => {
  const chatId = message.chat.id
  const msgId = message.message_id

  try {

    const msgCondition = (
      message.text !== 'Tavsiyalar 📨' && message.text !== 'Suhbatlar 🎙' &&
      message.text !== `Navbatdagi mehmon 🔊` && message.text !== `Savol yo'llang! 📩` &&
      message.text !== `Sozlamalar ⚙️` && message.text !== `Sovg'alar 🎁`
    )

    if (typeof (message.text) === 'string' && !(message.text.includes('/start'))) {
      const data = await fetch(`${server}/step`, {
        method: "POST",
        headers: {
          "Content-type": 'application/json; charset=UTF-8',
        },
        body: JSON.stringify({ user_tg_id: chatId })
      })
      const { user_step: userStep } = await data.json()

      const condition = (
        userStep !== 'first_name' && userStep !== 'last_name' &&
        userStep !== 'user_birth' && userStep !== 'gender' &&
        userStep !== 'region' && userStep !== 'profession'
      )
      if (!condition) {
        if (userStep === 'first_name') {
          if (message.text.length > 63) {
            await bot.sendChatAction(chatId, "typing")
            await bot.sendMessage(chatId, `Ismingizni juda uzun kiritdingiz(64 ta belgidan oshmasligi kerak) qisqaroq shaklda qaytatdan yuboring!`)
          } else {
            await sendDataAndUpdateStep('register', 'PUT', chatId, 'last_name', 'user_name', message.text)
            const user = await getUserInfo(chatId)
            await bot.sendMessage(chatId, `<b>${user.user_name}</b> familiyangizni kiriting!`, { parse_mode: "HTML" })
          }
        } else if (userStep === 'last_name') {
          if (message.text.length > 128) {
            await bot.sendChatAction(chatId, "typing")
            await bot.sendMessage(chatId, `Familiyangizni juda uzun kiritdingiz(64 ta belgidan oshmasligi kerak) qisqaroq shaklda qaytatdan yuboring!`)
          } else {
            await sendDataAndUpdateStep('register', 'PUT', chatId, 'user_birth', 'user_surname', message.text)
            const user = await getUserInfo(chatId)
            await bot.sendMessage(chatId, `<b>${user.user_name + ' ' + user.user_surname}</b> tug'ilgan yilingizni kiriting! \n\nMisol uchun: (2000)`, { parse_mode: "HTML" })
          }
        } else if (userStep === 'user_birth') {
          const DATE = new Date()
          const YEAR = DATE.getFullYear()
          if (!isNaN(message.text - 0) && !(Number(message.text) > YEAR) && (Number(message.text) > (YEAR - 120))) {
            await sendDataAndUpdateStep('register', 'PUT', chatId, 'gender', 'user_birth', message.text)
            await bot.sendMessage(chatId, 'Jinsingiz:', options.genderKeyboard)
          } else {
            await bot.sendMessage(chatId, "Tug'ilgan yilingizni to'g'ri kiriting")
          }
        }
      } else {
        if (message.text === 'Suhbatlar 🎙') {
          generateVideosList(bot, chatId, msgId)
        }

        if (message.text === 'Tavsiyalar 📨') {
          await deleteAndSendChatAction(bot, chatId, msgId, "typing")
          await bot.sendMessage(chatId, `Menyulardan birini tanlang:`, {
            reply_markup: JSON.stringify({
              inline_keyboard: [
                [
                  {
                    text: "Loyiha rivoji uchun",
                    callback_data: "advice_for_project"
                  },
                  {
                    text: "Navbatdagi mehmon",
                    callback_data: "advice_next_guess"
                  },
                ]
              ]
            })
          })
        }

        if (userStep === 'advice_for_project') {
          if (msgCondition) {
            await updateStep(chatId, 'finished_advice')
            const res = await fetch(`${server}/advice`, {
              method: "POST",
              headers: { "Content-type": 'application/json; charset=UTF-8' },
              body: JSON.stringify({ user_tg_id: chatId, advice_msg: message.text })
            })
            await bot.sendChatAction(chatId, "typing")
            await bot.sendMessage(chatId, "Taklif va tavsiyalaringiz qabul qilindi. 😊", {
              reply_markup: options.defaultMenu.reply_markup
            })
          }
        }

        if (message.text === "Savol yo'llang! 📩") {
          await deleteAndSendChatAction(bot, chatId, msgId, "typing")
          let msgText = ``
          msgText += `"<b>Osmondagi bolalar</b>" loyihasining navbatdagi mehmoni uchun o'zingizni qiziqtirgan savollarni yo'llashingiz mumkin!`
          msgText += `\n\n<b>Eslatma:</b> Savolingizni bitta xabarda joylashtiring! Savolingizga ijtimoiy tarmoqlarda joylashtirilgan postlar yoki ularning izohlari orqali javob berilmaganligiga ishonch hosil qiling.`
          await bot.sendMessage(chatId, msgText, { parse_mode: "HTML" })
          await updateStep(chatId, 'question')
        }

        if (userStep === 'question') {
          if (msgCondition) {
            await updateStep(chatId, 'finished_question')
            await fetch(`${server}/question`, {
              method: "POST",
              headers: { "Content-type": 'application/json; charset=UTF-8' },
              body: JSON.stringify({ user_tg_id: chatId, question_msg: message.text })
            })
            await bot.sendChatAction(chatId, "typing")
            await bot.sendMessage(chatId, "<b>✅ Savolingiz Osmondagi bolalar jamoasiga muvaffaqiyatli yuborildi.</b>", {
              reply_markup: options.defaultMenu.reply_markup,
              parse_mode: "HTML"
            })
          }
        }

        if (userStep === 'speaker_first_name') {
          if (msgCondition) {
            await fetch(`${server}/newspeaker`, {
              method: "POST",
              headers: { "Content-type": 'application/json; charset=UTF-8' },
              body: JSON.stringify({ user_tg_id: chatId, speaker_name: message.text })
            })
            await updateStep(chatId, 'speaker_last_name')
            await bot.sendMessage(chatId, 'Spikerning familiyasini kiriting:')
          }
        }

        if (userStep === 'speaker_last_name') {
          if (msgCondition) {
            await fetch(`${server}/newspeaker`, {
              method: "PUT",
              headers: { "Content-type": 'application/json; charset=UTF-8' },
              body: JSON.stringify({ key: 'speaker_surname', user_tg_id: chatId, value: message.text })
            })
            await updateStep(chatId, 'speaker_profession')
            await bot.sendMessage(chatId, 'Spikerning kasbini kiriting:', {
              reply_markup: options.professionKeyboard.reply_markup
            })
          }
        }

        if (userStep === 'speaker_why_you_watch') {
          if (msgCondition) {
            await fetch(`${server}/newspeaker`, {
              method: "PUT",
              headers: { "Content-type": 'application/json; charset=UTF-8' },
              body: JSON.stringify({ key: 'speaker_message', user_tg_id: chatId, value: message.text })
            })
            await updateStep(chatId, 'new_speaker_finished')
            await bot.sendMessage(chatId, `😊 Istaklaringiz qabul qilindi. Biz tavsiya qilgan spikeringizni tez orada o'rganib chiqamiz. Eslatib o'tamiz, hech kim va hech qachon bu loyihaga ma'lum mablag' evaziga chaqirilmaydi.`, {
              reply_markup: options.defaultMenu.reply_markup
            })
          }
        }

        if (message.text === 'Sozlamalar ⚙️') {
          await deleteAndSendChatAction(bot, chatId, msgId, "typing")
          await updateStep(chatId, 'user_settings')
          const response = await fetch(`${server}/user?user_tg_id=${chatId}`)
          const user = await response.json()

          let userSettings = ''

          userSettings += `<b>Sizning sozlamalaringiz:</b>`
          userSettings += `\n\n<b>Ismingiz</b>: ${user.user_name}`
          userSettings += `\n\n<b>Familiyangiz:</b> ${user.user_surname}`
          userSettings += `\n\n<b>Jinsingiz:</b> ${user.user_gender ? (user.user_gender === 'm' ? 'Erkak' : 'Ayol') : 'Ma\'lumotlar yo\'q'}`
          userSettings += `\n\n<b>Tug'ilgan yilingiz:</b> ${user.user_birth}`

          switch (user.user_prof) {
            case 'student':
              userSettings += '\n\n<b>Kasbingiz:</b> Talaba'
              break;
            case "teacher":
              userSettings += '\n\n<b>Kasbingiz:</b> O\'qituvchi'
              break;
            case "it_industry_representative":
              userSettings += '\n\n<b>Kasbingiz:</b> IT sohasi vakili'
              break;
            case "businessman":
              userSettings += '\n\n<b>Kasbingiz:</b> Tadbirkor'
              break;
            case "startup_owner":
              userSettings += '\n\n<b>Kasbingiz:</b> Startap egasi'
              break;
            case "medical_officer":
              userSettings += '\n\n<b>Kasbingiz:</b> Tibbiyot xodimi'
              break;
            case "journalist":
              userSettings += '\n\n<b>Kasbingiz:</b> Jurnalist'
              break;
            case "blogger":
              userSettings += '\n\n<b>Kasbingiz:</b> Bloger'
              break;
            case "athlete":
              userSettings += '\n\n<b>Kasbingiz:</b> Sportchi'
              break;
            case "blogger":
              userSettings += '\n\n<b>Kasbingiz:</b> Bloger'
              break;
            case "speaker":
              userSettings += '\n\n<b>Kasbingiz:</b> Spiker'
              break;
            case "military":
              userSettings += '\n\n<b>Kasbingiz:</b> Harbiy'
              break;
            case "other_job":
              userSettings += '\n\n<b>Kasbingiz:</b> Ma\'lum emas'
              break;
            default:
              userSettings += '\n\n<b>Kasbingiz:</b> Ma\'lumot yo\'q'
              break;
          }

          switch (user.user_region) {
            case 'andijan':
              userSettings += `\n\n<b>Yashash manzilingiz:</b> Andijon`
              break;
            case 'andijan':
              userSettings += `\n\n<b>Yashash manzilingiz:</b> Andijon`
              break;
            case 'bukhara':
              userSettings += `\n\n<b>Yashash manzilingiz:</b> Buxoro`
              break;
            case 'fergana':
              userSettings += `\n\n<b>Yashash manzilingiz:</b> Fargʻona`
              break;
            case 'jizzakh':
              userSettings += `\n\n<b>Yashash manzilingiz:</b> Jizzax`
              break;
            case 'urgench':
              userSettings += `\n\n<b>Yashash manzilingiz:</b> Xorazm`
              break;
            case 'namangan':
              userSettings += `\n\n<b>Yashash manzilingiz:</b> Namangan`
              break;
            case 'navai':
              userSettings += `\n\n<b>Yashash manzilingiz:</b> Navoiy`
              break;
            case 'kashkadarya':
              userSettings += `\n\n<b>Yashash manzilingiz:</b> Qashqadaryo`
              break;
            case 'nukus':
              userSettings += `\n\n<b>Yashash manzilingiz:</b> Qoraqalpogʻiston`
              break;
            case 'samarkand':
              userSettings += `\n\n<b>Yashash manzilingiz:</b> Samarqand`
              break;
            case 'sirdarya':
              userSettings += `\n\n<b>Yashash manzilingiz:</b> Sirdaryo`
              break;
            case 'surkhandarya':
              userSettings += `\n\n<b>Yashash manzilingiz:</b> Surxondaryo`
              break;
            case 'tashkentv':
              userSettings += `\n\n<b>Yashash manzilingiz:</b> Toshkent viloyati`
              break;
            case 'tashkent':
              userSettings += `\n\n<b>Yashash manzilingiz:</b> Toshkent shahri`
              break;
            default:
              userSettings += `\n\n<b>Yashash manzilingiz:</b> Ma'lum emas`
              break;
          }

          userSettings += `\n\n<b>Ma'lumotni tahrirlash uchun o'zgartirmoqchi bo'lgan bo'limingizni tanlang.</b>`

          await bot.sendChatAction(chatId, "typing")
          await bot.sendMessage(chatId, userSettings, options.userSettings)
        }

        if (userStep.startsWith('edit_user')) {
          async function updateUserSettings(key) {
            if (key === 'user_birth') {
              const DATE = new Date()
              const YEAR = DATE.getFullYear()
              if (!isNaN(message.text - 0) && !(Number(message.text) > YEAR) && (Number(message.text) > (YEAR - 120))) {
                await sendDataAndUpdateStep('register', 'PUT', chatId, `completed_${key}`, key, message.text)
                await bot.sendChatAction(chatId, "typing")
                await bot.sendMessage(chatId, 'Muvaffaqiyatli o\'zgartirildi', options.defaultMenu)
              } else {
                await bot.sendMessage(chatId, "Tug'ilgan yilingizni to'g'ri kiriting")
              }
            } else {
              await sendDataAndUpdateStep('register', 'PUT', chatId, `completed_${key}`, key, message.text)
              await bot.sendChatAction(chatId, "typing")
              await bot.sendMessage(chatId, 'Muvaffaqiyatli o\'zgartirildi', options.defaultMenu)
            }
          }
          if (msgCondition) {
            const key = userStep.split('edit_')[1]
            await updateUserSettings(key)
          }
        }
        if (message.text === `Sovg'alar 🎁`) {
          await bot.sendMessage(chatId, "Menyulardan birini tanlang", options.giftsMenu)
        }
      }
    } else if (typeof (message.text) !== 'string') {
      await bot.sendMessage(chatId, "To'g'ri qiymat kiriting")
    }
  } catch (error) {
    console.error(error)
  }
})

// on callback query

bot.on('callback_query', async (cb) => {
  const chatId = cb.message.chat.id
  const cbData = cb.data
  const cbId = cb.id
  const msgId = cb.message.message_id

  try {
    const data = await fetch(`${server}/step`, {
      method: "POST",
      headers: { "Content-type": 'application/json; charset=UTF-8', },
      body: JSON.stringify({ user_tg_id: chatId })
    })

    const { user_step: userStep } = await data.json()

    if (cbData === 'advice_for_project') {
      deleteAndSendChatAction(bot, chatId, msgId, "typing")
      await bot.sendMessage(chatId, "Loyiha rivoji uchun qanday tavsiyalar berishni istaysiz? \n\nO'z takliflaringizni bizga yo'llang 😊\n\nIltimos, bitta xabarda barcha matnni yozing.")
      await updateStep(chatId, "advice_for_project")
    }

    if (cbData === 'advice_next_guess') {
      await deleteAndSendChatAction(bot, chatId, msgId, "typing")
      await bot.sendMessage(chatId, `<b>"Osmondagi bolalar"</b> loyihasining navbatdagi soni kim bilan birga bo'lib o'tishini xohlaysiz? Taklif etilayotgan loyiha mehmonining ismini kiriting.`, { parse_mode: "HTML" })
      await updateStep(chatId, 'speaker_first_name')
    }

    if (cbData === 'user_settings_back') {
      await deleteAndSendChatAction(bot, chatId, msgId, "typing")
      await bot.sendMessage(chatId, "Asosiy menyudasiz", {
        reply_markup: options.defaultMenu.reply_markup
      })
    }

    if (cbData === 'videos_back') {
      await deleteAndSendChatAction(bot, chatId, msgId, "typing")
      await bot.sendMessage(chatId, "Asosiy menyudasiz", {
        reply_markup: options.defaultMenu.reply_markup
      })
    }

    if (cbData === 'video_back') {
      generateVideosList(bot, chatId, msgId)
    }

    if (cbData.startsWith('video_desc_back_')) {
      const data = await fetch(`${server}/video`, {
        method: "POST",
        headers: { "Content-type": 'application/json; charset=UTF-8' },
        body: JSON.stringify({ videoId: (cbData.split('video_desc_back_'))[1] })
      })

      const json = await data.json()

      const link = await json.link
      const title = await json.title
      const img = await json.imgUrl
      const desc = await json.description

      await deleteAndSendChatAction(bot, chatId, msgId, "typing")
      await bot.sendPhoto(chatId, img, {
        caption: title,
        reply_markup: {
          inline_keyboard: [
            [
              { text: '⬅️ Orqaga', callback_data: 'video_back' },
              { text: "Ta'rif", callback_data: `video_desc_${cbData}` },
              { text: "Havola", url: link }
            ],
            [{ text: 'Podcast 🎙', callback_data: `video_podcast_${cbData}` }]
          ]
        }
      })
    } else if (cbData.startsWith('video_desc_')) {
      const data = await fetch(`${server}/video`, {
        method: "POST",
        headers: { "Content-type": 'application/json; charset=UTF-8' },
        body: JSON.stringify({ videoId: (cbData.split('video_desc_')[1]) })
      })

      const json = await data.json()
      let desc = await json.description

      await deleteAndSendChatAction(bot, chatId, msgId, "typing")
      await bot.sendMessage(chatId, desc, {
        reply_markup: JSON.stringify({
          inline_keyboard: [[{ text: "⬅️ Orqaga", callback_data: `video_desc_back_${(cbData.split('video_desc_')[1])}` }]]
        }),
        disable_web_page_preview: true
      })
    } else if (cbData.startsWith('video_podcast_')) {
      const data = await fetch(`${server}/podcast?videoId=${cbData.split('video_podcast_')[1]}`)
      const json = await data.json()
      if (json.ishas) {
        json.data.map((obj, i) => {
          setTimeout(async () => {
            await bot.sendAudio(chatId, await obj.audio_tg_id)
          }, i * 500);
        })
      } else if (chatId == process.env.admin) {
        await bot.sendMessage(chatId, 'Podcast yuklanmoqda, yuklanish uzoq davom etishi mumkin...')
        let vlink = ''
        const url = `https://www.yt-download.org/api/button/mp3/${cbData.split('video_podcast_')[1]}`
        fetch(url).then((data) => {
          data.text().then((x) => {
            const dom = new JSDOM(x).window.document
            const link = dom.querySelectorAll('a')
            link.forEach(z => vlink = z.href)
          }).then(async () => {
            const file = fs.createWriteStream(`../audio/${cbData.split('video_podcast_')[1]}.mp3`)
            const request = https.get(await vlink, function (response) {
              response.pipe(file).on("finish", async () => {
                mp3Duration(`../audio/${cbData.split('video_podcast_')[1]}.mp3`, async (err, duration) => {
                  for (let i = 0; i < 4; i++) {
                    MP3Cutter.cut({
                      src: `../audio/${cbData.split('video_podcast_')[1]}.mp3`,
                      target: `../audio/parts/part${i + 1}.mp3`,
                      start: i * (duration / 4),
                      end: (i + 1) * (duration / 4)
                    });
                  }

                  await bot.sendAudio(chatId, `../audio/parts/part1.mp3`,).then(async (part1) => {
                    await fetch(`${server}/podcast`, {
                      method: "POST",
                      headers: { "Content-type": 'application/json; charset=UTF-8' },
                      body: JSON.stringify({ video_id: cbData.split('video_podcast_')[1], audio_tg_id: part1.audio.file_id })
                    })
                  })

                  await bot.sendAudio(chatId, `../audio/parts/part2.mp3`).then(async (part2) => {
                    await fetch(`${server}/podcast`, {
                      method: "POST",
                      headers: { "Content-type": 'application/json; charset=UTF-8' },
                      body: JSON.stringify({ video_id: cbData.split('video_podcast_')[1], audio_tg_id: part2.audio.file_id })
                    })
                  })

                  await bot.sendAudio(chatId, `../audio/parts/part3.mp3`).then(async (part3) => {
                    await fetch(`${server}/podcast`, {
                      method: "POST",
                      headers: { "Content-type": 'application/json; charset=UTF-8' },
                      body: JSON.stringify({ video_id: cbData.split('video_podcast_')[1], audio_tg_id: part3.audio.file_id })
                    })
                  })
                  await bot.sendAudio(chatId, `../audio/parts/part4.mp3`).then(async (part4) => {
                    await fetch(`${server}/podcast`, {
                      method: "POST",
                      headers: { "Content-type": 'application/json; charset=UTF-8' },
                      body: JSON.stringify({ video_id: cbData.split('video_podcast_')[1], audio_tg_id: part4.audio.file_id })
                    })
                  })
                })
              })
            })
          })
        })
      } else {
        await bot.sendMessage(chatId, 'Podcast admin tomonidan yuklanmoqda, yuklanish uzoq davom etishi mumkin...')
        const data = await fetch(`${server}/video`, {
          method: "POST",
          headers: { "Content-type": 'application/json; charset=UTF-8' },
          body: JSON.stringify({ videoId: cbData.split('video_podcast_')[1] })
        })

        const json = await data.json()
        const img = await json.imgUrl

        // Admin

        await bot.sendPhoto(process.env.admin, img, {
          caption: "Mana shu videoni podcastini so'rashdi",
        })
      }
    } else if (cbData === 'gifts_list_back') {
      await bot.sendMessage(chatId, "Asosiy menyudasiz", options.defaultMenu)
    } else if (cbData === "user_gifts") {
      const data = await readFile('../src/contents/gifts.text', 'utf8')
      await bot.sendChatAction(chatId, "typing")
      await bot.sendMessage(chatId, data)
    } else if (cbData === 'user_get_score') {
      const data = await fetch(`${server}/userscore?user_tg_id=${chatId}`)
      const json = await data.json()
      await bot.editMessageText(`Sizning hisobingizda: ${json.user_score} ball mavjud.`, {
        chat_id: chatId,
        message_id: msgId
      })
    } else if (cbData === 'user_set_score') {
      let msgText = ''
      msgText += '<b>"Osmondagi bolalar"</b> loyihasining rasmiy <b>bot</b> xizmatiga xush kelibsiz!'
      msgText += `\n\n🎁 "Osmondagi bolalar" loyihasining Telegram botiga obuna bo'lib, do'stlaringizni taklif eting va <b>maxsus</b> sovg'aga ega bo'ling.`
      msgText += `\n\n🎯 Har bir taklif etgan do'stingiz uchun sizga <b>5</b> balldan berib boriladi, taklif etilgan do'stingiz ushbu botga obuna bo'lgan bo'lishlari lozim. Qancha ko'p do'stingizni taklif qilsangiz, <b>loyihamiz</b> tomonidan maxsus sovg'a sizga taqdim etiladi. \n\nDo'stlaringizni taklif qilish uchun quyidagi xabarni ular bilan ulashing!`
      msgText += `\n\nYoki quyidagi linkni do'stlaringizga ulashib ham ball to'plashingiz mumkin: \n\nhttps://t.me/osmondagibolalarr_bot?start=${chatId}`
      await bot.editMessageText(msgText, {
        parse_mode: "HTML",
        chat_id: chatId,
        message_id: msgId
      })
      await bot.sendMessage(chatId, `🎁 "Osmondagi bolalar" loyihasining Telegram botiga obuna bo'lib, do'stlaringizni taklif eting. <b>Har bir</b> taklif etilgan do'stingiz uchun 5 <b>ballga</b> ega bo'ling va <b>maxsus</b> sovg'a sohibiga aylaning 🤩\n\n😉 Sizga ball taqdim etilishi uchun do'stingiz ro'yxatdan o'tgan bo'lishi lozim.`, {
        parse_mode: "HTML",
        reply_markup: JSON.stringify({
          inline_keyboard: [
            [
              {
                text: "Botga obuna bo'lish",
                url: `t.me/osmondagibolalarr_bot?start=${chatId}`
              }
            ]
          ]
        })
      })
    }

    else if (userStep === 'gender') {
      await sendDataAndUpdateStep('register', 'PUT', chatId, 'region', 'user_gender', cbData)
      await bot.editMessageText("Qaysi viloyatda istiqomat qilasiz?", {
        chat_id: chatId,
        message_id: msgId,
        reply_markup: options.regionsKeyboard.reply_markup
      })
    } else if (userStep === 'region') {
      await sendDataAndUpdateStep('register', 'PUT', chatId, 'profession', 'user_region', cbData)
      await bot.editMessageText("Qanday kasbda faoliyat yuritasiz?", {
        chat_id: chatId,
        message_id: msgId,
        reply_markup: options.professionKeyboard.reply_markup
      })
    } else if (userStep === 'profession') {
      const res = await fetch(`${server}/preusers?joiner_id=${chatId}`)
      const json = await res.json()
      if (json.length) {
        const data = await fetch(`${server}/user/score?chatId=${json[0].sharer_id}`)
        const userData = await data.json()
        if (userData[0].user_score > 999) {
          await bot.sendMessage(json[0].sharer_id, "Hisobingizga 5 ball qo'shildi \n\n📞 Sovg'ani qabul qilib olish uchun bizga <b>murojaat qiling:</b> \n\n+998 90 0707884", { parse_mode: "HTML" })
        } else {
          await bot.sendMessage(json[0].sharer_id, "Hisobingizga 5 ball qo'shildi", { parse_mode: "HTML" })
        }
        await fetch(`${server}/preusers`, {
          method: "DELETE",
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ joiner_id: chatId })
        })
        await fetch(`${server}/userscore`, {
          method: "PUT",
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ user_tg_id: json[0].sharer_id })
        })
      }
      await sendDataAndUpdateStep('register', 'PUT', chatId, 'login_completed', 'user_prof', cbData)
      await deleteAndSendChatAction(bot, chatId, msgId, "typing")
      const msgText = `🙂 <b>Osmondagi bolalar</b> — hayotning past-u balandiga qaramasdan o‘z shijoat-g‘ayrati bilan yuqori marralarni zabt eta olgan, yoshlarga chinakam motivatsiya rolini bajarib beradigan insonlarni samimiy suhbat orqali o‘zida jam qilgan yangi interaktiv ko‘rsatuv. \n\n🧗‍♂️<b>Osmondagi bolalar</b> — ko‘rsatuvining aktual missiyasi katta natijalarni qo‘lga kiritgan yoshlarni ommaga tanitish va ularni bu yo‘ldagi xato, qiyinchiliklar, to‘plangan tajribalarini jamiyat bilan bo‘lishishdan iborat!`
      await bot.sendMessage(chatId, msgText, options.defaultMenu)
    } else if (userStep === 'videos') {
      generateVideo(bot, chatId, msgId, cbData)
    } else if (userStep === 'speaker_profession') {
      await fetch(`${server}/newspeaker`, {
        method: "PUT",
        headers: { "Content-type": 'application/json; charset=UTF-8' },
        body: JSON.stringify({ key: 'speaker_profession', user_tg_id: chatId, value: cbData })
      })
      await updateStep(chatId, 'speaker_why_you_watch')
      await bot.editMessageText("Nega aynan ushbu odamni tavsiya qilyapsiz?", {
        chat_id: chatId,
        message_id: msgId
      })
    } else if (userStep === 'user_settings') {
      const key = cbData.split('user_settings_')[1]
      async function notificationForUser(msg, new_step) {
        await deleteAndSendChatAction(bot, chatId, msgId, "typing")
        await bot.sendMessage(chatId, msg, {
          parse_mode: "HTML"
        })
        await fetch(`${server}/step`, {
          method: "PUT",
          headers: { "Content-type": 'application/json; charset=UTF-8', },
          body: JSON.stringify({ user_tg_id: chatId, user_step: new_step })
        })
      }

      if (key === 'user_name') {
        await notificationForUser('Ismingizni kiriting', 'edit_user_name')
      } else if (key === 'user_surname') {
        await notificationForUser('Familiyangizni kiriting', 'edit_user_surname')
      } else if (key === 'user_birth') {
        const user = await getUserInfo(chatId)
        await notificationForUser(`<b>${user.user_name + ' ' + user.user_surname}</b> tug'ilgan yilingizni kiriting! \n\nMisol uchun: (2000)`, 'edit_user_birth')
      } else if (key === 'user_gender') {
        await bot.editMessageText("Jinsingiz", {
          chat_id: chatId,
          message_id: msgId,
          reply_markup: JSON.stringify({
            inline_keyboard: [[
              { text: `Erkak`, callback_data: "edit_user_gender_m" },
              { text: "Ayol", callback_data: "edit_user_gender_f" }
            ]]
          })
        })
        await updateStep(chatId, 'edit_user_gender')
      } else if (key === 'user_prof') {
        await deleteAndSendChatAction(bot, chatId, msgId, "typing")
        await bot.sendMessage(chatId, "Qanday kasbda faoliyat yuritasiz?", options.professionKeyboard)
        await updateStep(chatId, 'edit_user_prof')
      } else if (key === 'user_region') {
        await deleteAndSendChatAction(bot, chatId, msgId, "typing")
        await bot.sendMessage(chatId, "Qaysi viloyatda istiqomat qilasiz?", options.regionsKeyboard)
        await updateStep(chatId, 'edit_user_region')
      }
    } else if (userStep === 'edit_user_gender') {
      const gender = cbData.split('edit_user_gender_')[1]
      await sendDataAndUpdateStep('register', 'PUT', chatId, 'completed_user_gender', 'user_gender', gender)
      await deleteAndSendChatAction(bot, chatId, msgId, "typing")
      await bot.sendMessage(chatId, "Muvaffaqiyatli o'zgartirildi", options.defaultMenu)
    } else if (userStep === 'edit_user_prof') {
      await sendDataAndUpdateStep('register', 'PUT', chatId, 'completed_user_prof', 'user_prof', cbData)
      await deleteAndSendChatAction(bot, chatId, msgId, "typing")
      await bot.sendMessage(chatId, "Muvaffaqiyatli o'zgartirildi", options.defaultMenu)
    } else if (userStep === 'edit_user_region') {
      await sendDataAndUpdateStep('register', 'PUT', chatId, 'completed_user_region', 'user_region', cbData)
      await deleteAndSendChatAction(bot, chatId, msgId, "typing")
      await bot.sendMessage(chatId, "Muvaffaqiyatli o'zgartirildi", options.defaultMenu)
    }

    await bot.answerCallbackQuery(cbId)
  } catch (error) {
    console.error(error)
  }
})