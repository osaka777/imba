import commonStyles from "@styles/common.module.css";
import styles from "./Main.module.css";
import featuresStyles from "./features.module.css";
import productStyles from "./product.module.css";
import regStyles from "./reg.module.css";
import faqStyles from "./faq.module.css";
import Link from "next/link";
import {
    IndicatorImg,
    MapImg,
    StatisticLine,
    StatisticShadow,
    TelegramIcon,
} from "@/shared/assets/icons";
import { MessageImgage, BallImgage, TabletImgage } from "@/shared/assets/images";
import Image from "next/image";
import { AuthForm } from "@/entities/user";
import { KickPartnersScoreboard } from "@/widgets/KickPartnersScoreboard/KickPartnersScoreboard";

export default function Home() {
    return (
        <main className={`${commonStyles.pageContainer} ${styles.main}`}>
            {/* ── Hero ── */}
            <section className={styles.hero}>
                <div className={styles.heroInner}>
                    <div className={styles.heroGrid}>
                        <div className={styles.heroLeft}>
                            <span className={styles.eyebrow}>Offer #1</span>
                            <h1 className={styles.title}>
                                Зарабатывай вместе с&nbsp;лучшим{" "}
                                <span className={styles.titleAccent}>
                                    Gambling&nbsp;&amp;&nbsp;Betting
                                </span>{" "}
                                продуктом
                            </h1>
                            <Link href="#contacts" className={styles.cta}>
                                Стать партнёром
                            </Link>
                        </div>
                        <div className={styles.heroRight}>
                            <div className={styles.heroGlow} />
                            <div className={styles.offerCards}>
                                <div className={`${styles.offerCard} ${styles.offerCardPurple}`}>
                                    <span className={styles.offerLabel}>RevShare</span>
                                    <span className={`${styles.offerValue} ${styles.offerValueHighlight}`}>От 50%</span>
                                </div>
                                <div className={`${styles.offerCard} ${styles.offerCardBlue}`}>
                                    <span className={styles.offerLabel}>CPA</span>
                                    <span className={styles.offerValue}>по запросу</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <KickPartnersScoreboard />
                </div>
            </section>

            {/* ── Features ── */}
            <section id="features" className={featuresStyles.section}>
                <div className={featuresStyles.wrapper}>
                    <div className={featuresStyles.header}>
                        <span className={featuresStyles.anhor}>Features</span>
                        <h2 className={featuresStyles.titleDark}>
                            Развитая экосистема для максимального дохода
                        </h2>
                    </div>

                    <div className={featuresStyles.content_top}>
                        <div className={`${featuresStyles.card} ${featuresStyles.statistic}`}>
                            <h3 className={featuresStyles.item_title}>
                                Статистика в реальном времени
                            </h3>
                            <div className={featuresStyles.statistic_body}>
                                <span className={featuresStyles.statistic_line}>
                                    <StatisticLine className={featuresStyles.statistic_svg} />
                                </span>
                                <StatisticShadow className={featuresStyles.line_bg} />
                                <span className={featuresStyles.statistic_span_online}>Online</span>
                                <span className={featuresStyles.statistic_span_badge}>
                                    <span className={featuresStyles.statistic_bage_date}>30 July</span>
                                    <span className={featuresStyles.statistic_badge_text}>186,40 $</span>
                                </span>
                            </div>
                        </div>

                        <div className={`${featuresStyles.card} ${featuresStyles.indicators}`}>
                            <div className={featuresStyles.indicators_body}>
                                <h3 className={featuresStyles.item_title}>
                                    Высокие показатели Retention и LTV
                                </h3>
                                <p className={featuresStyles.item_desc}>
                                    Свои локальные колл-центры, VIP и саппорт отделы, welcome бонусы,
                                    программа лояльности и многое другое
                                </p>
                            </div>
                            <IndicatorImg className={featuresStyles.indicators_svg} />
                        </div>
                    </div>

                    <div className={featuresStyles.content_bottom}>
                        <h3 className={featuresStyles.bottom_title}>География нашего бренда</h3>
                        <div className={featuresStyles.bottom_body}>
                            <p className={featuresStyles.bottom_desc}>
                                Охватываем все континенты благодаря локальным платежным системам. Адаптируем
                                продукт под каждое гео, чтобы пользователь видел привычный интерфейс с
                                быстрой загрузкой.
                            </p>
                            <div className={featuresStyles.bottom_map}>
                                <MapImg />
                            </div>
                        </div>
                        <div className={featuresStyles.bottom_footer}>
                            <p className={featuresStyles.footer_text}>
                                Партнёры по всему миру уже зарабатывают на трафике вместе с нами
                            </p>
                            <Link href="#contacts" className={featuresStyles.link}>
                                Стать партнёром
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── Product ── */}
            <section id="product" className={productStyles.section}>
                <div className={productStyles.container}>
                    <div className={productStyles.header}>
                        <span className={productStyles.header_anchor}>Product</span>
                        <h2 className={productStyles.header_title}>
                            Наша высокая конверсия — твой высокий доход
                        </h2>
                        <div className={productStyles.header_wrapper}>
                            <p className={productStyles.header_description}>
                                Игроки остаются с нами после первого депозита, потому что всегда находят
                                что-то для себя среди тысячи развлечений.
                            </p>
                        </div>
                    </div>
                    <div className={productStyles.wrapper_content}>
                        <div className={productStyles.content}>
                            <div className={productStyles.wrapper_cards}>
                                <div className={productStyles.card}>
                                    <div className={productStyles.card_content}>
                                        <div className={productStyles.wrapper_ball_img}>
                                            <Image
                                                src={BallImgage}
                                                className={productStyles.ball_img}
                                                alt=""
                                                width={40}
                                                height={40}
                                            />
                                        </div>
                                        <p className={productStyles.card_title}>Спорт</p>
                                        <p className={productStyles.card_desc}>
                                            Широкая линия, высокие коэффициенты, live-трансляции популярных событий
                                        </p>
                                        <p className={productStyles.card_subText}>Широкая линия live-событий</p>
                                    </div>
                                </div>
                            </div>
                            <div className={productStyles.wrapper_img}>
                                <Image src={TabletImgage} alt="" width={600} height={530} />
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── FAQ ── */}
            <section id="FAQ" className={faqStyles.section}>
                <div className={faqStyles.wrapper}>
                    <div className={faqStyles.header}>
                        <span className={faqStyles.anchor}>FAQ</span>
                        <h2 className={faqStyles.titleDart}>
                            Ответы на часто задаваемые вопросы
                        </h2>
                    </div>
                    <div className={faqStyles.content}>
                        <div className={faqStyles.left_side}>
                            <div className={faqStyles.messege1}>
                                <div className={faqStyles.messege_icon}>
                                    <Image src={MessageImgage} alt="" width={36} height={36} />
                                </div>
                                <div className={faqStyles.message_wrapper}>
                                    <p className={faqStyles.message_text}>
                                        Привет! Расскажите о вашей компании 🤔
                                    </p>
                                    <p className={faqStyles.message_time}>8:42 PM</p>
                                </div>
                            </div>
                            <div className={faqStyles.messege2}>
                                <div className={faqStyles.message_wrapper_support}>
                                    <p className={faqStyles.message_text_support}>
                                        Привет! 👋 Мы — партнёрская программа лидера iGaming-рынка imba. С нами
                                        ты получишь высокую конверсию, лучшие условия монетизации на рынке и
                                        частые выплаты. Стартуем?
                                    </p>
                                    <p className={faqStyles.message_time}>8:42 PM</p>
                                </div>
                            </div>
                            <div className={faqStyles.messege3}>
                                <div className={faqStyles.messege_icon}>
                                    <Image src={MessageImgage} alt="" width={36} height={36} />
                                </div>
                                <div className={faqStyles.message_wrapper}>
                                    <p className={faqStyles.message_text}>Мне нравится, давайте работать 🔥</p>
                                    <p className={faqStyles.message_time}>8:42 PM</p>
                                </div>
                            </div>
                        </div>
                        <div className={faqStyles.right_side}>
                            {[
                                {
                                    q: "Как я могу зарабатывать на партнерской программе?",
                                    a: "Ты привлекаешь игроков на сайт imba, а мы выплачиваем прибыль по выбранной модели сотрудничества (RevShare или CPA). Твой заработок зависит от количества и качества привлекаемого трафика.",
                                },
                                {
                                    q: "Какая разница между моделями RevShare и CPA?",
                                    a: "По модели RevShare вы со старта получаете 50% от общей прибыли компании с каждого привлеченного вами игрока пожизненно. Все комиссии и операционные расходы мы покрываем сами. Оплата по CPA – это фиксированная выплата за каждого игрока, совершившего целевое действие.",
                                },
                                {
                                    q: "Как получить повышенную выплату?",
                                    a: "Мы готовы сделать индивидуальный оффер каждому вебмастеру. Ставки по RevShare повышаем в индивидуальном порядке после успешно пролитого объема по стартовой ставке 50% GGR.",
                                },
                                {
                                    q: "Как часто я буду получать выплаты?",
                                    a: "По модели RevShare выплачиваем каждый вторник. Активным партнерам выплаты доступны в любое время. По модели CPA выплачиваем в любой удобный день. Холд по CPA — 7 дней.",
                                },
                                {
                                    q: "В чем преимущества работы с imba Partners?",
                                    a: "Как лидер мы предлагаем высокую и постоянную стартовую ставку по RevShare, приватные условия по CPA и продукт с отличной конверсией click2reg и reg2dep на любом источнике трафика.",
                                },
                            ].map(({ q, a }) => (
                                <div key={q} className={faqStyles.question_wrapper}>
                                    <h3 className={faqStyles.question_title}>{q}</h3>
                                    <p className={faqStyles.question_text}>{a}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* ── Registration ── */}
            <section id="contacts" className={regStyles.section}>
                <div className={regStyles.container}>
                    <div className={regStyles.content}>
                        <div className={regStyles.body}>
                            <span className={regStyles.eyebrow}>Регистрация</span>
                            <h2 className={regStyles.title}>
                                Начни зарабатывать прямо сейчас
                            </h2>
                            <p className={regStyles.text}>
                                После регистрации с тобой свяжется менеджер — ответит на все вопросы и
                                поможет с запуском!
                            </p>
                            <div className={regStyles.contactSocials}>
                                <p className={regStyles.socialsText}>Связаться с нами</p>
                                <div className={regStyles.items}>
                                    <a
                                        href="https://t.me/imbabetofficial"
                                        rel="noopener noreferrer"
                                        target="_blank"
                                        className={regStyles.telegramLink}
                                    >
                                        <span className={regStyles.iconWrapper}>
                                            <TelegramIcon />
                                        </span>
                                        <span className={regStyles.linkBody}>
                                            <span className={regStyles.linkTitle}>Telegram</span>
                                            <span className={regStyles.linkText}>@imbabetofficial</span>
                                        </span>
                                    </a>
                                </div>
                            </div>
                        </div>
                        <div className={regStyles.registrationForm}>
                            <AuthForm />
                        </div>
                    </div>
                </div>
            </section>
        </main>
    );
}
