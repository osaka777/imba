'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import styles from './LuckyDriveModal.module.css';
import { verifyUser, getUser } from '~/entities/user/api';
import { Dialog, DialogContent } from '~/shared/ui';
import { DepositForm } from '~/entities/finance';
import { AuthForm } from '~/entities/user';
import { StepsImageMobile, CheckIcon } from '~/shared/assets';
import Image from 'next/image';
import { createBet } from '~/entities/bet/api/createBet';

interface Balance {
  id: string;
  amount: string;
  currencyCode: string;
}

interface UserData {
  balances?: Balance[];
}

interface LuckyDriveModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LuckyDriveModal: React.FC<LuckyDriveModalProps> = ({ isOpen, onClose }) => {
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [authModalType, setAuthModalType] = useState<'closed' | 'login' | 'register'>('closed');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  
  const authCheckCompleted = useRef(false);
  
  const checkAuth = async () => {
    if (isLoading) return;
    
    if (authCheckCompleted.current) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      const isAuth = await verifyUser();
      setIsAuthenticated(isAuth);
      
      if (isAuth) {
        try {
          const user = await getUser();
          if (user) {
            setUserData(user as UserData);
          } else {
            setUserData(null);
          }
        } catch (userError) {
          console.error('Failed to get user data:', userError);
          setUserData(null);
        }
      } else {
        setUserData(null);
      }
      
      authCheckCompleted.current = true;
    } catch (authError) {
      console.error('Authentication check failed:', authError);
      setError('Не удалось проверить авторизацию');
      setIsAuthenticated(false);
      setUserData(null);
    } finally {
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    if (isOpen && !authCheckCompleted.current) {
      checkAuth();
    }
    
    return () => {
      authCheckCompleted.current = false;
    };
  }, [isOpen]);
  
  useEffect(() => {
    if (authModalType === 'closed' && isDepositModalOpen === false) {
      if (authCheckCompleted.current) {
        authCheckCompleted.current = false;
        setTimeout(() => {
          checkAuth();
        }, 500);
      }
    }
  }, [authModalType, isDepositModalOpen]);
  
  const hasDeposit = !!userData?.balances?.some((balance: Balance) => 
    parseFloat(balance.amount) > 0
  );
  
  const handleLoginClick = () => {
    setAuthModalType('login');
  };
  
  const handleRegisterClick = () => {
    setAuthModalType('register');
  };
  
  const handleDepositClick = () => {
    setIsDepositModalOpen(true);
  };
  
  const closeDepositModal = () => {
    setIsDepositModalOpen(false);
  };
  
  const closeAuthModal = () => {
    setAuthModalType('closed');
  };
  
  const handleRetryClick = () => {
    authCheckCompleted.current = false;
    setError(null);
    checkAuth();
  };
  
  const handleGetTicketClick = async () => {
    if (!isAuthenticated || !hasDeposit) {
      return;
    }
    
    try {
      const defaultCurrency = userData?.balances?.[0]?.currencyCode || 'USD';
      const minimumAmount = 10;
      
      const userBalance = userData?.balances?.find(
        (balance) => balance.currencyCode === defaultCurrency
      )?.amount;
      
      if (!userBalance || parseFloat(userBalance) < minimumAmount) {
        return;
      }
      
      // Новый формат DTO для создания ставки
      const dto: import('~/shared/api').components["schemas"]["CreateBetDto"] = {
        eventId: 'lucky-drive-ticket',
        marketId: 'lucky-drive',
        outcomeId: 'ticket',
        odds: 1.01,
        stake: minimumAmount,
        currency: defaultCurrency,
        betType: 'ORDINAR',
        betVariant: 'ORDINAR',
        betInfo: 'Lucky Drive ticket'
      };
      
      await createBet(dto);
      
      onClose();
    } catch (e: any) {
      // Пытаемся достать детальные ошибки валидации
      const validationErrors = e?.data?.errors as Array<{
        property: string;
        value?: unknown;
        constraints?: Record<string, string>;
      }> | undefined;

      if (validationErrors && validationErrors.length) {
        const msgs: string[] = [];
        for (const ve of validationErrors) {
          const constraints = ve.constraints ? Object.values(ve.constraints) : [];
          if (constraints.length) {
            msgs.push(...constraints);
          } else if (ve.property) {
            msgs.push(`Поле ${ve.property} не прошло валидацию`);
          }
        }
        setError(msgs.join('; '));
      } else {
        console.error('Failed to get ticket:', e);
        setError(e?.message || 'Не удалось получить билет. Попробуйте позже.');
      }
    }
  };
  
  if (!isOpen) return null;

  return (
    <>
      <div className={styles.modalOverlay} onClick={onClose}>
        <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
          <main className={styles.modalBody}>
            <div className={styles.base}>
              <div className={styles.imageWrapper}>
                <Image 
                  src={StepsImageMobile} 
                  alt="Lucky Drive" 
                  className={styles.image} 
                  priority
                />
              </div>
              <div className={styles.title}>Выполняйте шаги и выиграйте авто</div>
              <div className={styles.subtitle}>Розыгрыш состоится: 15.12.2025</div>
              
              {error && (
                <div className={styles.errorMessage}>
                  {error}
                  <button 
                    type="button" 
                    onClick={handleRetryClick}
                    style={{ 
                      marginLeft: '8px', 
                      background: 'transparent', 
                      border: 'none',
                      color: 'white',
                      textDecoration: 'underline',
                      cursor: 'pointer'
                    }}
                  >
                    Повторить
                  </button>
                </div>
              )}
              
              {isLoading ? (
                <div className={styles.loading}>
                  <div 
                    style={{ 
                      borderRadius: '50%',
                      border: '2px solid rgba(255,255,255,0.2)',
                      borderTop: '2px solid white',
                      width: '16px',
                      height: '16px',
                      animation: 'spin 1s linear infinite',
                      marginRight: '8px'
                    }}
                  ></div>
                  Загрузка...
                </div>
              ) : (
                <>
                  <div className={styles.steps}>
                    <div className={styles.step}>
                      <div className={styles.stepText}>Зарегистрироваться</div>
                      {isAuthenticated ? (
                        <div className={styles.stepDoneLabel}>
                          <div className={styles.stepDoneLabelCheck}>
                            <CheckIcon className={styles.stepDoneLabelCheckIcon} />
                          </div>
                          Выполнено
                        </div>
                      ) : (
                        <div className={styles.stepButtons}>
                          <button 
                            className={styles.stepButton} 
                            type="button"
                            onClick={handleLoginClick}
                          >
                            Войти
                          </button>
                          <button 
                            className={styles.stepButton} 
                            type="button"
                            onClick={handleRegisterClick}
                          >
                            Регистрация
                          </button>
                        </div>
                      )}
                    </div>
                    
                    <div className={styles.step}>
                      <div className={styles.stepText}>Сделать всего один депозит от 10 $</div>
                      {hasDeposit ? (
                        <div className={styles.stepDoneLabel}>
                          <div className={styles.stepDoneLabelCheck}>
                            <CheckIcon className={styles.stepDoneLabelCheckIcon} />
                          </div>
                          Выполнено
                        </div>
                      ) : (
                        <button 
                          className={styles.stepButton} 
                          type="button"
                          onClick={handleDepositClick}
                          disabled={!isAuthenticated}
                        >
                          Пополнить
                        </button>
                      )}
                    </div>
                  </div>
                  
                  <button 
                    className={styles.button} 
                    disabled={!(isAuthenticated && hasDeposit)} 
                    type="button"
                    onClick={handleGetTicketClick}
                  >
                    Забрать билет
                  </button>
                </>
              )}
            </div>
          </main>
        </div>
      </div>

      {authModalType !== 'closed' && (
        <Dialog open={true} onOpenChange={closeAuthModal}>
          <DialogContent className={styles.authDialog} title={authModalType === "login" ? "Вход в систему" : "Регистрация"}>
            <AuthForm 
              authVariant={authModalType} 
              className={styles.authForm} 
            />
          </DialogContent>
        </Dialog>
      )}

      {isDepositModalOpen && (
        <Dialog open={true} onOpenChange={closeDepositModal}>
          <DialogContent className={styles.depositDialog} title="Пополнение счета">
            <DepositForm />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};