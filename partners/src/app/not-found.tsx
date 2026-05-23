import { Button } from "@/shared/UI";

export default function NotFound() {
    return (
        <div
            style={{
                height: "780px",

                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "column",
                gap: "24px",
            }}
        >
            <h2
                style={{
                    fontSize: "20px",
                }}
            >{`Страница не найдена`}</h2>
            <Button
                style={{
                    fontSize: "20px",
                    borderRadius: "8px",

                    padding: "12px 32px",

                    backgroundColor: "var(--blue-30)",

                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                }}
                elementType="link"
                href="/"
            >
                {`Вернутся на главную`}
            </Button>
        </div>
    );
}
