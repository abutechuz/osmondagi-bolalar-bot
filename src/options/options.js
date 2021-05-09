module.exports.defaultMenu = {
  parse_mode: "HTML",
  reply_markup: JSON.stringify({
    keyboard: [
      ["Suhbatlar 🎙", "Tavsiyalar 📨"],
      [ "Sovg'alar 🎁", "Savol yo'llang! 📩",],
      ["Sozlamalar ⚙️"]
    ],
    resize_keyboard:true
  })
}

module.exports.giftsMenu = {
  reply_markup: JSON.stringify({
    inline_keyboard: [
      [
        {
          text: "Sovg'a turlari 🛍",
          callback_data: 'user_gifts'
        },
        {
          text: "Ball to'plash 📲",
          callback_data: 'user_set_score'
        },
      ],
      [
        {
          text: "Hisobim 🧮",
          callback_data: 'user_get_score'
        },
        {
          text: "Orqaga",
          callback_data: 'gifts_list_back'
        }
      ]
    ]
  })
}

module.exports.userSettings = {
  parse_mode: "HTML",
  reply_markup: JSON.stringify({
    inline_keyboard: [
      [
        {
          text: "Ism",
          callback_data: "user_settings_user_name"
        },
        {
          text: "Familiya",
          callback_data: "user_settings_user_surname"
        }
      ],
      [
        {
          text: "Tug'ilgan yil",
          callback_data: "user_settings_user_birth"
        },
        {
          text: "Jins",
          callback_data: "user_settings_user_gender"
        }
      ],
      [
        {
          text: "Kasb",
          callback_data: "user_settings_user_prof"
        },
        {
          text: "Viloyat",
          callback_data: "user_settings_user_region"
        }
      ],
      [
        {
          text: "⬅️ Orqaga",
          callback_data: "user_settings_back"
        }
      ]
    ],
  })
}

module.exports.genderKeyboard = {
  reply_markup: JSON.stringify({
    inline_keyboard: [
      [
        {
          text: `Erkak`,
          callback_data: "m"
        },
        {
          text: "Ayol",
          callback_data: "f"
        }
      ]
    ]
  })
}

module.exports.regionsKeyboard = {
  reply_markup: JSON.stringify({
    resize_keyboard: true,
    one_time_keyboard: true,
    inline_keyboard: [
      [
        {
          text: "Andijon",
          callback_data: "andijan"
        },
        {
          text: "Buxoro",
          callback_data: "bukhara"
        }
      ],
      [
        {
          text: "Fargʻona",
          callback_data: "fergana"
        },
        {
          text: "Jizzax",
          callback_data: "jizzakh"
        }
      ],
      [
        {
          text: "Xorazm",
          callback_data: "urgench"
        },
        {
          text: "Namangan",
          callback_data: "namangan"
        }
      ],
      [
        {
          text: "Navoiy",
          callback_data: "navai"
        },
        {
          text: "Qashqadaryo",
          callback_data: "kashkadarya"
        }
      ],
      [
        {
          text: "Qoraqalpogʻiston",
          callback_data: "nukus"
        },
        {
          text: "Samarqand",
          callback_data: "samarkand"
        }
      ],
      [
        {
          text: "Sirdaryo",
          callback_data: "sirdarya"
        },
        {
          text: "Surxondaryo",
          callback_data: "surkhandarya"
        }
      ],
      [
        {
          text: "Toshkent viloyati",
          callback_data: "tashkentv"
        },
        {
          text: "Toshkent shahri",
          callback_data: "tashkent"
        }
      ],
      [
        {
          text: "Boshqa",
          callback_data: "other"
        }
      ]
    ]
  })
}

module.exports.professionKeyboard = {
  reply_markup: JSON.stringify({
    resize_keyboard: true,
    one_time_keyboard: true,
    inline_keyboard: [
      [
        {
          text: "Talaba",
          callback_data: "student"
        },
        {
          text: "O'qituvchi",
          callback_data: "teacher"
        }
      ],
      [
        {
          text: "IT sohasi vakili",
          callback_data: "it_industry_representative"
        },
        {
          text: "Tadbirkor",
          callback_data: "businessman"
        }
      ],
      [
        {
          text: "Startap egasi",
          callback_data: "startup_owner"
        },
        {
          text: "Tibbiyot xodimi",
          callback_data: "medical_officer"
        }
      ],
      [
        {
          text: "Jurnalist",
          callback_data: "journalist"
        },
        {
          text: "Sportchi",
          callback_data: "athlete"
        }
      ],
      [
        {
          text: "Bloger",
          callback_data: "blogger"
        },
        {
          text: "O'quvchi",
          callback_data: "pupil"
        }
      ],
      [
        {
          text: "Motivator",
          callback_data: "motivator"
        },
        {
          text: "Harbiy",
          callback_data: "military"
        }
      ],
      [
        {
          text: "Boshqa",
          callback_data: "other_job"
        }
      ]
    ]
  })
}