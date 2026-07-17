"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import { useRouter } from "next/navigation";

import { LogoWhiteIcon, TelegramIcon } from "@/shared/assets";
import { Support as SupportAvatar, MessageImgage } from "@/shared/assets/images";
import { useRegister } from "@/entities/user/model/useRegister";
import { useLogin } from "@/entities/user/model/useLogin";
import { KickSupportDock } from "@/widgets/KickLanding/KickSupportDock";
import { KickLiveStats } from "@/widgets/KickLanding/KickLiveStats";
import { KickWelcomeBonusCompact } from "@/widgets/KickLanding/KickWelcomeBonus";

import styles from "./kick-landing.module.css";

const SUPPORT_GENERAL = "https://t.me/imbabetchat";
const SUPPORT_MANAGER = "https://t.me/imbabetofficial";

const STEPS = [
  {
    n: "01",
    title: "Регистрация",
    text: "Укажите Kick-канал — мы сразу подготовим партнёрские ссылки с sub1=kick.",
  },
  {
    n: "02",
    title: "Подключение OAuth",
    text: "В кабинете «Стрим» — один клик, чат-бот и webhook активируются автоматически.",
  },
  {
    n: "03",
    title: "Монетизация эфира",
    text: "Подключи Kick — получи $10 welcome-бонус. Вывод от $50 после первой регистрации с твоей ссылки.",
  },
] as const;

type FormState = {
  email: string;
  password: string;
  kickChannel: string;
  telegram: string;
  checked: boolean;
};

const initialValues: FormState = {
  email: "",
  password: "",
  kickChannel: "",
  telegram: "",
  checked: false,
};

export function KickLandingPage() {
  const [mode, setMode] = useState<"register" | "login">("register");
  const { error, pending, register } = useRegister();
  const {
    error: loginError,
    errorCode: loginErrorCode,
    login,
    pending: loginPending,
  } = useLogin();
  const [formError, setFormError] = useState("");
  const [loginFormError, setLoginFormError] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const router = useRouter();

  const formik = useFormik({
    initialValues,
    validationSchema: Yup.object({
      email: Yup.string().required("Введите почту").email("Неверный формат почты"),
      password: Yup.string().required("Введите пароль").min(8, "Минимум 8 символов"),
      kickChannel: Yup.string().required("Укажите ваш Kick-канал"),
      checked: Yup.boolean().isTrue("Нужно согласие с условиями"),
    }),
    validateOnBlur: false,
    validateOnChange: false,
    onSubmit: async (values) => {
      setFormError("");
      const channel = values.kickChannel.trim().replace(/^@/, "");
      const trafficSource = channel
        ? `https://kick.com/${encodeURIComponent(channel)}`
        : "https://kick.com/";

      const resp = await register({
        email: values.email,
        password: values.password,
        type: "REVSHARE",
        trafficSource,
        meta: {
          telegram: values.telegram.trim(),
          source: "kick.imba.bet",
          kickChannel: channel,
        },
      });

      if (resp) {
        router.push("/profile/stream?kick=welcome");
      }
    },
  });

  const onField = (name: keyof FormState) => (value: string | boolean) => {
    void formik.setFieldValue(name, value);
    if (formError) setFormError("");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors = await formik.validateForm();
    if (Object.keys(errors).length > 0) {
      const first = Object.values(errors)[0];
      setFormError(typeof first === "string" ? first : "Проверьте поля формы");
      return;
    }
    await formik.submitForm();
  };

  const submitLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginFormError("");
    if (!loginEmail.trim()) {
      setLoginFormError("Введите почту");
      return;
    }
    if (!loginPassword) {
      setLoginFormError("Введите пароль");
      return;
    }
    const ok = await login({ email: loginEmail.trim(), password: loginPassword });
    if (ok) {
      router.push("/profile/stream");
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.grid} aria-hidden />
      <div className={styles.glowA} aria-hidden />
      <div className={styles.glowB} aria-hidden />
      <div className={styles.glowC} aria-hidden />

      <header className={styles.topbar}>
        <div className={styles.brandWrap}>
          <Image
            className={styles.logo}
            src={LogoWhiteIcon}
            alt="imba.bet"
            width={130}
            height={20}
            priority
          />
          <span className={styles.brandDivider} aria-hidden />
          <span className={styles.brandKick}>
            × <b>Kick</b> Partners
          </span>
        </div>
        <div className={styles.topActions}>
          <Link className={styles.topLink} href="/guide">
            Гид по монетизации
          </Link>
          <a
            className={styles.topSupport}
            href={SUPPORT_GENERAL}
            rel="noreferrer"
            target="_blank"
          >
            Чат поддержки
          </a>
          <Link className={styles.topLink} href="https://imba.bet" rel="noreferrer" target="_blank">
            imba.bet ↗
          </Link>
        </div>
      </header>

      <main className={styles.main}>
        <section className={styles.hero}>
          <span className={styles.eyebrow}>
            <span className={styles.liveDot} aria-hidden />
            Kick × imba Partners
          </span>
          <KickLiveStats />
          <h1 className={styles.title}>
            Монетизируй свой
            {" "}
            <span className={styles.titleAccent}>Kick-эфир</span>
            {" "}
            с revshare до 50%
          </h1>
          <p className={styles.subtitle}>
            Подключи канал, получи ссылки для чата, OBS-оверлей, чат-бота и аналитику
            трафика с эфира — всё в одном кабинете партнёра imba.bet.
            {" "}
            <Link className={styles.topLink} href="/guide">
              Читать полный гид →
            </Link>
          </p>

          <div className={styles.stats}>
            <div className={styles.stat}>
              <span className={styles.statValue}>до 50%</span>
              <span className={styles.statLabel}>RevShare</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statValue}>$10</span>
              <span className={styles.statLabel}>welcome-бонус</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statValue}>24/7</span>
              <span className={styles.statLabel}>тех-поддержка</span>
            </div>
          </div>

          <section className={styles.steps}>
            <h2 className={styles.sectionTitle}>Как это работает</h2>
            <div className={styles.stepsGrid}>
              {STEPS.map((step) => (
                <article className={styles.stepCard} key={step.n}>
                  <span className={styles.stepNum}>{step.n}</span>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </article>
              ))}
            </div>
          </section>

          <section className={styles.supportSection}>
            <h2 className={styles.sectionTitle}>Поддержка для стримеров</h2>
            <div className={styles.supportGrid}>
              <div className={styles.chatPreview}>
                <div className={styles.chatPreviewHead}>
                  <Image alt="" height={32} src={SupportAvatar} width={32} />
                  <div>
                    <strong>imba.bet Support</strong>
                    <span>онлайн · ~3 мин</span>
                  </div>
                </div>
                <div className={styles.chatPreviewBody}>
                  <div className={styles.chatMsgAgent}>
                    Привет! Поможем подключить Kick и настроить OBS 👋
                  </div>
                  <div className={styles.chatMsgUser}>Хочу revshare для стрима</div>
                  <div className={styles.chatMsgAgent}>
                    Регистрируйся справа — после этого OAuth в 1 клик 🔥
                  </div>
                </div>
              </div>

              <div className={styles.supportCards}>
                <a
                  className={styles.supportCard}
                  href={SUPPORT_GENERAL}
                  rel="noreferrer"
                  target="_blank"
                >
                  <span className={styles.supportCardBadge}>Общая</span>
                  <h3>Тех-поддержка imba.bet</h3>
                  <p>Вопросы по сайту, ставкам и аккаунту игрока</p>
                  <span className={styles.supportCardLink}>@imbabetchat →</span>
                </a>
                <a
                  className={`${styles.supportCard} ${styles.supportCardAccent}`}
                  href={SUPPORT_MANAGER}
                  rel="noreferrer"
                  target="_blank"
                >
                  <span className={styles.supportCardBadge}>Личная</span>
                  <h3>Менеджер Kick-партнёров</h3>
                  <p>RevShare, офер, OBS, выплаты — напрямую в Telegram</p>
                  <span className={styles.supportCardCta}>
                    <TelegramIcon />
                    @imbabetofficial
                  </span>
                </a>
              </div>
            </div>
          </section>
        </section>

        <section className={styles.formSection} id="join">
          <div className={styles.formCard}>
            <div className={styles.formCardGlow} aria-hidden />
            <p className={styles.formEyebrow}>Старт за 2 минуты</p>
            <KickWelcomeBonusCompact />
            <div className={styles.formTabs}>
              <button
                type="button"
                className={`${styles.tab} ${mode === "register" ? styles.tabActive : ""}`}
                onClick={() => setMode("register")}
              >
                Регистрация
              </button>
              <button
                type="button"
                className={`${styles.tab} ${mode === "login" ? styles.tabActive : ""}`}
                onClick={() => setMode("login")}
              >
                Вход
              </button>
            </div>

            {mode === "register" ? (
              <form className={styles.form} onSubmit={submit}>
                <label className={styles.field}>
                  <span className={styles.label}>Kick-канал</span>
                  <div className={styles.inputWrap}>
                    <span className={styles.prefix}>@</span>
                    <input
                      className={styles.input}
                      name="kickChannel"
                      placeholder="your_channel"
                      value={formik.values.kickChannel}
                      onChange={(e) => onField("kickChannel")(e.target.value)}
                      autoComplete="username"
                    />
                  </div>
                </label>

                <label className={styles.field}>
                  <span className={styles.label}>Email</span>
                  <input
                    className={styles.input}
                    type="email"
                    name="email"
                    placeholder="you@mail.com"
                    value={formik.values.email}
                    onChange={(e) => onField("email")(e.target.value)}
                    autoComplete="email"
                  />
                </label>

                <label className={styles.field}>
                  <span className={styles.label}>Пароль</span>
                  <input
                    className={styles.input}
                    type="password"
                    name="password"
                    placeholder="Минимум 8 символов"
                    value={formik.values.password}
                    onChange={(e) => onField("password")(e.target.value)}
                    autoComplete="new-password"
                  />
                </label>

                <label className={styles.field}>
                  <span className={styles.label}>Telegram (необязательно)</span>
                  <input
                    className={styles.input}
                    name="telegram"
                    placeholder="@username"
                    value={formik.values.telegram}
                    onChange={(e) => onField("telegram")(e.target.value)}
                  />
                </label>

                <label className={styles.agree}>
                  <input
                    checked={formik.values.checked}
                    className={styles.checkbox}
                    type="checkbox"
                    onChange={(e) => onField("checked")(e.target.checked)}
                  />
                  <span>
                    Согласен с условиями партнёрской программы imba.bet
                  </span>
                </label>

                <button className={styles.submit} disabled={pending} type="submit">
                  {pending ? "Создаём аккаунт…" : "Зарегистрироваться и получить $10 →"}
                </button>

                {formError ? <p className={styles.error}>{formError}</p> : null}
                {error ? <p className={styles.error}>{error}</p> : null}

                <p className={styles.afterSubmit}>
                  После регистрации подключите Kick в 1 клик — welcome $10 придёт на баланс.
                </p>
              </form>
            ) : (
              <form className={styles.form} onSubmit={submitLogin}>
                <label className={styles.field}>
                  <span className={styles.label}>Email</span>
                  <input
                    className={styles.input}
                    type="email"
                    name="loginEmail"
                    placeholder="you@mail.com"
                    value={loginEmail}
                    onChange={(e) => {
                      setLoginEmail(e.target.value);
                      if (loginFormError) setLoginFormError("");
                    }}
                    autoComplete="email"
                  />
                </label>

                <label className={styles.field}>
                  <span className={styles.label}>Пароль</span>
                  <input
                    className={styles.input}
                    type="password"
                    name="loginPassword"
                    placeholder="Введите пароль"
                    value={loginPassword}
                    onChange={(e) => {
                      setLoginPassword(e.target.value);
                      if (loginFormError) setLoginFormError("");
                    }}
                    autoComplete="current-password"
                  />
                </label>

                <button className={styles.submit} disabled={loginPending} type="submit">
                  {loginPending ? "Входим…" : "Войти в кабинет"}
                </button>

                {loginFormError ? <p className={styles.error}>{loginFormError}</p> : null}
                {loginErrorCode === 401 ? (
                  <p className={styles.error}>Логин или пароль введены неверно</p>
                ) : null}
                {loginError && loginErrorCode !== 401 ? (
                  <p className={styles.error}>{loginError}</p>
                ) : null}

                <p className={styles.afterSubmit}>
                  После входа откроется раздел «Стрим» для подключения Kick.
                </p>
              </form>
            )}

            <div className={styles.formSupportHint}>
              <Image alt="" height={24} src={MessageImgage} width={24} />
              <span>
                Нужна помощь?
                {" "}
                <a href={SUPPORT_MANAGER} rel="noreferrer" target="_blank">
                  @imbabetofficial
                </a>
              </span>
            </div>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerBrand}>
          <Image alt="imba.bet" height={20} src={LogoWhiteIcon} width={130} />
          <span>× Kick Partners</span>
        </div>
        <div className={styles.footerLinks}>
          <Link href="/guide">Гид по монетизации Kick</Link>
          <a href={SUPPORT_GENERAL} rel="noreferrer" target="_blank">
            Поддержка
          </a>
          <a href={SUPPORT_MANAGER} rel="noreferrer" target="_blank">
            Менеджер
          </a>
          <Link href="https://partners.imba.bet">partners.imba.bet</Link>
        </div>
      </footer>

      <KickSupportDock />
    </div>
  );
}
