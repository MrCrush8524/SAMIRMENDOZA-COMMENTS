extends Node

const STRINGS := {
	"en": {
		"title": "IN SAMIR'S MIND",
		"tagline": "Walk Through Dreams",
		"new_dream": "New Dream",
		"continue": "Continue",
		"settings": "Settings",
		"extras": "Extras",
		"soundtrack": "Dream Soundtrack",
		"select_dreamer": "Select Your Dreamer",
		"enter_name": "What should we call you?",
		"name_placeholder": "Your name",
		"confirm": "Confirm",
		"change_character": "Change Character",
		"resume_game": "Resume",
	},
	"es": {
		"title": "EN LA MENTE DE SAMIR",
		"tagline": "Camina a Través de los Sueños",
		"new_dream": "Nuevo Sueño",
		"continue": "Continuar",
		"settings": "Ajustes",
		"extras": "Extras",
		"soundtrack": "Banda Sonora",
		"select_dreamer": "Elige a tu Soñador",
		"enter_name": "¿Cómo te llamamos?",
		"name_placeholder": "Tu nombre",
		"confirm": "Confirmar",
		"change_character": "Cambiar Personaje",
		"resume_game": "Reanudar",
	},
	"pt-BR": {
		"title": "NA MENTE DO SAMIR",
		"tagline": "Caminhe Através dos Sonhos",
		"new_dream": "Novo Sonho",
		"continue": "Continuar",
		"settings": "Configurações",
		"extras": "Extras",
		"soundtrack": "Trilha Sonora",
		"select_dreamer": "Escolha seu Sonhador",
		"enter_name": "Como devemos te chamar?",
		"name_placeholder": "Seu nome",
		"confirm": "Confirmar",
		"change_character": "Trocar Personagem",
		"resume_game": "Continuar",
	},
}

var current_lang: String = "en"

func set_language(lang: String) -> void:
	current_lang = lang if STRINGS.has(lang) else "en"

func t(key: String) -> String:
	return STRINGS.get(current_lang, STRINGS["en"]).get(key, key)
