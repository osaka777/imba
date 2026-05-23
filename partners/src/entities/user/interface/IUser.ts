import Decimal from "decimal.js";

export interface IUser {
    id: number;
    email: string;
    affilator: {
        type: string;
        meta: {
            telegram: string | null;
            phone: string | null;
            whatsapp: string | null;
            wallet: string | null;
        },
        trafficSource: string,
        uid: string;
        percent: string;
    }
    balances: {
        id: number;
        currencyCode: string;
        amount: number;
    }[]
    operations: {
        id: number;
        status: 'WAITING' | "SUCCESS" | "FAILED"
        type: 'INCOME' | 'OUTCOME';
        amount: number;
        currencyCode: string;
    }[]
}