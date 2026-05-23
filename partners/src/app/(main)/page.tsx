import commonStyles from "@styles/common.module.css";
import { Metadata } from "next";
import styles from "./Main.module.css";
import featuresStyles from "./features.module.css";
import productStyles from "./product.module.css";
import regStyles from "./reg.module.css";
import faqStyles from "./faq.module.css";
import Link from "next/link";
import { StarIcon } from "@/shared/assets";
import {
    IndicatorImg,
    MapImg,
    StatisticLine,
    StatisticShadow,
    TelegramIcon,
    TopWhiteBorderImage,
} from "@/shared/assets/icons";
import { MessageImgage, PeoplesImgage, TabletImgage, BallImgage } from "@/shared/assets/images";
import Image from "next/image";
import { AuthForm } from "@/entities/user";



export default function Home() {


    return (
        <main className={`${commonStyles.pageContainer} ${styles.main}`}>
            <div className={commonStyles.wrapper}>
            <section className={styles.main_bg}>
                <div className={styles.container}>
                    <div className={styles.content}>
                        <div className={styles.header}>
                            <p className={styles.anchor}>offer #1</p>
                            <h1 className={styles.title}>
                                <span className={styles.span}>
                                    Зарабатывай вместе с&nbsp;лучшим <span>Gambling&nbsp;&amp;&nbsp;Betting</span>{" "}
                                    продуктом
                                </span>
                            </h1>
                        </div>
                        <Link href="#contacts" className={styles.router_link}>
                            <span className={styles.decor}>
                                <span className={styles.decor_items}></span>
                                <span className={styles.decor_items}></span>
                            </span>
                            <span>Стать партнёром</span>
                        </Link>
                    </div>
                    <div className={styles.items}>
                        <div className={styles.item_purple}>
                            <div className={styles.item_body}>
                                <span className={styles.item_title}>RevShare</span>
                                <span className={styles.item_desc}>От 50%</span>
                            </div>
                        </div>
                        <div className={styles.item_blue}>
                            <div className={styles.item_body}>
                                <span className={styles.item_title}>CPA</span>
                                <span className={styles.item_desc}>до $200</span>
                            </div>
                        </div>
                    </div>
                    <div className={styles.root}>
                        <p className={styles.root_title}>Помогаем расти каждый день и зарабатывать больше</p>
                        <div className={styles.root_items}>
                            <div className={styles.root_item}>
                                <span className={styles.root_item_title}>30&nbsp;000&nbsp;000</span>
                                <span className={styles.root_item_desc}>Пользователей</span>
                            </div>
                            <div className={styles.root_star}>
                                <StarIcon />
                            </div>
                            <div className={styles.root_item}>
                                <span className={styles.root_item_title}>100&nbsp;000 +</span>
                                <span className={styles.root_item_desc}>Партнеров</span>
                            </div>
                            <div className={styles.root_star}>
                                <StarIcon />
                            </div>
                            <div className={styles.root_item}>
                                <span className={styles.root_item_title}>$ 1&nbsp;000&nbsp;000</span>
                                <span className={styles.root_item_desc}>Ежедневно выплачиваем партнерам</span>
                            </div>
                        </div>
                    </div>
                    <div className={styles.ui_bg}>
                        <div className={styles.ui_bg_item}></div>
                        <span></span>
                    </div>
                </div>
            </section>
            <section id="features" className={featuresStyles.section}>
                <div className={featuresStyles.wrapper}>
                    <div className={featuresStyles.content}>
                        <div className={styles.container}>
                            <div className={featuresStyles.body}>
                                <div className={featuresStyles.header}>
                                    <p className={featuresStyles.anhor}>features</p>
                                    <h2 className={featuresStyles.titleDark}>
                                        Развитая экосистема для максимального дохода
                                    </h2>
                                </div>
                                <div className={featuresStyles.content_top}>
                                    <div className={featuresStyles.statistic}>
                                        <h3
                                            className={` ${featuresStyles.statistic_title} ${featuresStyles.item_title}`}
                                        >
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
                                                <span className={featuresStyles.statistic_badge_text}> 1900,89 $ </span>
                                            </span>
                                        </div>
                                    </div>
                                    <div className={featuresStyles.indicators}>
                                        <div className={featuresStyles.indicators_body}>
                                            <h3
                                                className={`${featuresStyles.item_title} ${featuresStyles.indicators_title}`}
                                            >
                                                Высокие показатели Retention и LTV
                                            </h3>
                                            <p
                                                className={`${featuresStyles.item_desc} ${featuresStyles.indicators_desc}`}
                                            >
                                                Свои локальные колл-центры, VIP и саппорт отделы, welcome бонусы,
                                                программа лояльности и многое другое
                                            </p>
                                        </div>
                                        <IndicatorImg className={featuresStyles.indicators_svg} />
                                    </div>
                                    <div className={featuresStyles.applications}>
                                        <h3
                                            className={` ${featuresStyles.applications_title} ${featuresStyles.item_title}`}
                                        >
                                            iOS &amp; Android приложения для залива трафика
                                        </h3>
                                        <p className={featuresStyles.item_desc}>
                                            Выдаем бесплатные приложения с привлекательным дизайном и лучшей конверсией
                                        </p>
                                        <div className={featuresStyles.applications_icon}>
                                            <span></span>
                                        </div>
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
                                        <div className={featuresStyles.footer_body}>
                                            <p className={featuresStyles.footer_text}>
                                                Более 100 000 партнеров уже зарабатывают на трафике вместе с нами
                                            </p>
                                        </div>
                                        <Link aria-current="page" href="#contacts" className={featuresStyles.link}>
                                            <span>Стать партнёром</span>
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className={featuresStyles.root}></div>
            </section>
            <section id="product" className={productStyles.section}>
                <div className={productStyles.container}>
                    <div className={productStyles.header}>
                        <div className={productStyles.header_body}>
                            <p className={productStyles.header_anchor}>product</p>
                            <h1 className={productStyles.header_title}>Наша высокая конверсия — твой высокий доход </h1>
                            <div className={productStyles.header_wrapper}>
                                <p className={productStyles.header_description}>
                                    Игроки остаются с нами после первого депозита, потому что всегда находят что-то для
                                    себя среди тысячи развлечений.
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className={productStyles.wrapper_content}>
                        <div className={productStyles.content}>
                            <div className={productStyles.wrapper_cards}>
                                <div className={productStyles.card}>
                                    <div className={productStyles.card_content}>
                                        <div className={productStyles.wrapper_ball_img}>
                                            <Image src={BallImgage} className={productStyles.ball_img} alt="" />
                                        </div>
                                        <p className={productStyles.card_title}>Спорт</p>
                                        <p className={productStyles.card_desc}>
                                            Широкая линия, высокие коэффициенты, live-трансляции популярных событий
                                        </p>
                                        <p className={productStyles.card_subText}>Более 10 000 событий в день</p>
                                    </div>
                                </div>
                            </div>
                            <div className={productStyles.wrapper_img}>
                                <Image src={TabletImgage} alt="" />
                            </div>
                        </div>
                    </div>
                </div>
            </section>
            <section id="FAQ" className={faqStyles.section}>
                <div className={faqStyles.wrapper}>
                    <TopWhiteBorderImage className={faqStyles.wrapper_svg} />
                    <div className={faqStyles.content_wrapper}>
                        <div className={faqStyles.container}>
                            <div className={faqStyles.header}>
                                <p className={faqStyles.anchor}>FAQ</p>
                                <h2 className={faqStyles.titleDart}>Ответы на часто задаваемые вопросы</h2>
                            </div>
                            <div className={faqStyles.content}>
                                <div className={faqStyles.left_side}>
                                    <div className={faqStyles.messege1}>
                                        <div className={faqStyles.messege_icon}>
                                            <Image src={MessageImgage} alt="" />
                                        </div>
                                        <div className={faqStyles.message_wrapper}>
                                            <p className={faqStyles.message_text}>
                                                Привет! Расскажите о вашей компании 🤔
                                            </p>
                                            <p className={faqStyles.message_time}> 8:42 PM </p>
                                            {/* svg */}
                                        </div>
                                    </div>
                                    <div className={faqStyles.messege2}>
                                        <div className={faqStyles.message_wrapper_support}>
                                            <p className={faqStyles.message_text_support}>
                                                Привет! 👋 Мы — партнерская программа лидера iGaming-рынка imba. С нами
                                                ты получишь высокую конверсию, лучшие условия монетизации на рынке и
                                                частые выплаты. Стартуем?{" "}
                                            </p>
                                            <p className={faqStyles.message_time}> 8:42 PM </p>
                                            {/* svg */}
                                        </div>
                                        {/* <div className=></div> */}
                                    </div>
                                    <div className={faqStyles.messege3}>
                                        <div className={faqStyles.messege_icon}>
                                            <Image src={MessageImgage} alt="" />
                                        </div>
                                        <div className={faqStyles.message_wrapper}>
                                            <p className={faqStyles.message_text}>Мне нравится, давайте работать 🔥</p>
                                            <p className={faqStyles.message_time}> 8:42 PM </p>
                                            {/* svg */}
                                        </div>
                                    </div>
                                </div>
                                <div className={faqStyles.right_side}>
                                    <div className={faqStyles.question_wrapper}>
                                        <h3 className={faqStyles.question_title}>
                                            Как я могу зарабатывать на партнерской программе?
                                        </h3>
                                        <p className={faqStyles.question_text}>
                                            Ты привлекаешь игроков на сайт imba, а мы выплачиваем прибыль по выбранной
                                            модели сотрудничества (RevShare или CPA). Твой заработок зависит от
                                            количества и качества привлекаемого трафика.
                                        </p>
                                    </div>
                                    <div className={faqStyles.question_wrapper}>
                                        <h3 className={faqStyles.question_title}>
                                            Какая разница между моделями RevShare и CPA?
                                        </h3>
                                        <p className={faqStyles.question_text}>
                                            По модели RevShare вы со старта получаете 50% от общей прибыли компании с
                                            каждого привлеченного вами игрока пожизненно. Все комиссии и операционные
                                            расходы мы покрываем сами. Оплата по СРА – это фиксированная выплата за
                                            каждого игрока, совершившего целевое действие. Мы ставим простые KPI, потому
                                            что заинтересованы в твоём и нашем росте.
                                        </p>
                                    </div>
                                    <div className={faqStyles.question_wrapper}>
                                        <h3 className={faqStyles.question_title}>Как получить повышенную выплату?</h3>
                                        <p className={faqStyles.question_text}>
                                            Мы готовы сделать индивидуальный оффер каждому вебмастеру. Для этого нужно
                                            предоставить максимум вводной информации о трафике, например, его источнике
                                            и объеме. Ставки по RevShare повышаем в индивидуальном порядке после успешно
                                            пролитого объема по стартовой ставке 50% GGR.
                                        </p>
                                    </div>
                                    <div className={faqStyles.question_wrapper}>
                                        <h3 className={faqStyles.question_title}>Как часто я буду получать выплаты?</h3>
                                        <p className={faqStyles.question_text}>
                                            По модели RevShare выплачиваем каждый вторник. Активным партнерам выплаты
                                            доступны в любое время. По модели СРА выплачиваем в любой удобный день. Холд
                                            по СРА — 7 дней.
                                        </p>
                                    </div>
                                    <div className={faqStyles.question_wrapper}>
                                        <h3 className={faqStyles.question_title}>
                                            В чем преимущества работы с imba Partners?
                                        </h3>
                                        <p className={faqStyles.question_text}>
                                            Как лидер мы предлагаем высокую и постоянную стартовую ставку по RevShare,
                                            приватные условия по СРА и продукт с отличной конверсией click2reg и reg2dep
                                            на любом источнике трафика.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
            <section id="contacts" className={regStyles.section}>
                <div className={regStyles.container}>
                    <div id="contacts" className={regStyles.content}>
                        <div>
                            <div className={regStyles.body}>
                                <div className={regStyles.imageWrapper}>
                                    <Image className={regStyles.peopleImg} src={PeoplesImgage} alt="" />
                                </div>

                                <div className={regStyles.textWrapper}>
                                    <h2 className={regStyles.title}>Начни зарабатывать прямо сейчас</h2>
                                    <p className={regStyles.text}>
                                        После регистрации с тобой свяжется менеджер - ответит на все вопросы и поможет с
                                        запуском!
                                    </p>
                                </div>
                            </div>
                            <div className={regStyles.contactSocials}>
                                <p className={regStyles.socialsText}>Связаться с нами</p>

                                <div className={regStyles.items}>
                                    <a
                                        href="/"
                                        rel="noopener noreferrer nofollow"
                                        target="_blank"
                                        className={regStyles.telegramLink}
                                    >
                                        <span className={regStyles.iconWrapper}>
                                            {" "}
                                            <TelegramIcon />
                                        </span>
                                        <span className={regStyles.linkBody}>
                                            <span className={regStyles.linkTitle}>Telegram</span>
                                            <span className={regStyles.linkText}>@imbasupport</span>
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
            </div>
        </main>
    );
}
