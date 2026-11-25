import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { gsap } from 'gsap';
import { AuthService } from '../../core/auth.service';
import { ToastService } from '../../core/toast.service';

interface WaterBubble {
  id: number;
  leftPct: number;
  sizePx: number;
  duration: number;
  delay: number;
  driftX: number;
  opacity: number;
}

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    :host { display: block; }

    .login-stage {
      min-height: 100vh;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 28px 18px;
      overflow: hidden;
      background: radial-gradient(ellipse at 50% 0%, #0d3a7d 0%, #061c42 48%, #031028 100%);
      isolation: isolate;
    }

    /* =====================================================
       GSAP ANIMATED AQUATIC BACKDROP LAYERS
       ===================================================== */
    .aquatic-backdrop {
      position: absolute;
      inset: 0;
      pointer-events: none;
      overflow: hidden;
      z-index: 0;
    }

    .parallax-layer {
      position: absolute;
      inset: -40px;
      will-change: transform;
    }

    /* Luminous water-caustic orbs */
    .caustic-orb {
      position: absolute;
      border-radius: 50%;
      filter: blur(72px);
      will-change: transform, opacity;
    }
    .caustic-orb-1 {
      width: 520px;
      height: 520px;
      top: -160px;
      left: -110px;
      background: radial-gradient(circle, rgba(20, 184, 232, 0.42) 0%, rgba(10, 132, 255, 0.14) 55%, transparent 75%);
    }
    .caustic-orb-2 {
      width: 580px;
      height: 580px;
      bottom: -190px;
      right: -130px;
      background: radial-gradient(circle, rgba(0, 114, 245, 0.46) 0%, rgba(14, 165, 233, 0.16) 55%, transparent 75%);
    }
    .caustic-orb-3 {
      width: 360px;
      height: 360px;
      top: 32%;
      right: 14%;
      background: radial-gradient(circle, rgba(56, 217, 255, 0.24) 0%, rgba(10, 132, 255, 0.06) 60%, transparent 75%);
    }

    /* Subtle sunlight caustic rays from top surface */
    .water-rays {
      position: absolute;
      inset: 0;
      background:
        conic-gradient(from 195deg at 50% -18%,
          transparent 0deg,
          rgba(125, 211, 252, 0.08) 12deg,
          transparent 26deg,
          rgba(56, 189, 248, 0.06) 40deg,
          transparent 56deg,
          rgba(186, 230, 253, 0.07) 72deg,
          transparent 90deg);
      opacity: 0.9;
    }

    /* Rising crystalline bubbles */
    .bubble-field {
      position: absolute;
      inset: 0;
      overflow: hidden;
    }
    .water-bubble {
      position: absolute;
      bottom: -36px;
      border-radius: 50%;
      background: radial-gradient(circle at 32% 28%,
        rgba(255, 255, 255, 0.85) 0%,
        rgba(125, 211, 252, 0.34) 45%,
        rgba(14, 165, 233, 0.08) 100%);
      border: 1px solid rgba(255, 255, 255, 0.26);
      box-shadow: inset 0 0 6px rgba(255, 255, 255, 0.35);
      will-change: transform, opacity;
    }

    /* Seamless undulating ocean wave bands */
    .wave-band {
      position: absolute;
      left: 0;
      bottom: 0;
      width: 200%;
      height: 210px;
      will-change: transform;
    }
    .wave-band-back {
      height: 225px;
      opacity: 0.42;
    }
    .wave-band-front {
      height: 175px;
      opacity: 0.62;
    }

    /* =====================================================
       UNIFIED LOGIN CARD (LOGO + FORM IN ONE CONTAINER)
       ===================================================== */
    .login-shell {
      position: relative;
      z-index: 2;
      width: 100%;
      max-width: 446px;
    }

    .login-card {
      position: relative;
      background: rgba(255, 255, 255, 0.96);
      backdrop-filter: blur(22px);
      -webkit-backdrop-filter: blur(22px);
      border-radius: 26px;
      padding: 32px 34px 30px;
      border: 1px solid rgba(255, 255, 255, 0.9);
      box-shadow:
        0 32px 72px -18px rgba(2, 14, 42, 0.68),
        0 0 0 1px rgba(125, 211, 252, 0.18),
        inset 0 1px 0 rgba(255, 255, 255, 1);
      overflow: hidden;
      will-change: transform, opacity;
    }

    /* Subtle luminous top aqua rim inside card */
    .login-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 4px;
      background: linear-gradient(90deg, #0066e6 0%, #0ea5e9 50%, #22d3ee 100%);
    }

    /* Integrated Brand Lockup inside the Card */
    .card-brand {
      display: flex;
      align-items: center;
      gap: 14px;
      padding-bottom: 22px;
      margin-bottom: 22px;
      border-bottom: 1px solid #e6f0fa;
    }

    .brand-mark {
      width: 54px;
      height: 54px;
      border-radius: 16px;
      background: linear-gradient(145deg, #e7f4ff 0%, #cce8ff 100%);
      border: 1px solid #c3e2fd;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      box-shadow: 0 8px 20px -6px rgba(10, 132, 255, 0.34);
      will-change: transform;
    }

    .brand-copy {
      min-width: 0;
    }
    .brand-wordmark {
      font-size: 24px;
      font-weight: 800;
      color: #071e40;
      letter-spacing: -0.03em;
      line-height: 1.05;
      margin: 0;
    }
    .brand-slogan {
      font-family: 'Caveat', 'Segoe Script', cursive;
      font-size: 18px;
      font-weight: 700;
      color: #0b66d4;
      line-height: 1.15;
      margin: 3px 0 0;
    }

    /* Form Heading */
    .form-heading {
      margin-bottom: 20px;
    }
    .form-heading h2 {
      font-size: 19px;
      font-weight: 800;
      color: #0b2242;
      letter-spacing: -0.02em;
      margin: 0 0 3px;
    }
    .form-heading p {
      font-size: 13px;
      color: #647b96;
      margin: 0;
    }

    /* Tactile Input With Leading Icon */
    .input-shell {
      position: relative;
      display: flex;
      align-items: center;
    }
    .input-icon {
      position: absolute;
      left: 13px;
      color: #7c95b2;
      display: inline-flex;
      align-items: center;
      pointer-events: none;
      transition: color 0.15s;
    }
    .input-shell:focus-within .input-icon {
      color: #0a84ff;
    }
    .login-input {
      height: 44px;
      padding-left: 40px;
      padding-right: 14px;
      border-radius: 12px;
      background: #f6faff;
      border: 1.5px solid #dbe7f5;
      font-size: 13.5px;
      transition: background 0.16s, border-color 0.16s, box-shadow 0.16s;
    }
    .login-input:focus {
      background: #ffffff;
      border-color: #0a84ff;
      box-shadow: 0 0 0 4px rgba(10, 132, 255, 0.13);
    }
    .login-input.has-toggle {
      padding-right: 44px;
    }

    .pwd-toggle {
      position: absolute;
      right: 10px;
      top: 50%;
      transform: translateY(-50%);
      border: none;
      background: transparent;
      cursor: pointer;
      color: #7c95b2;
      width: 32px;
      height: 32px;
      border-radius: 8px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: color 0.15s, background 0.15s;
    }
    .pwd-toggle:hover {
      color: #0066e6;
      background: #e9f3ff;
    }

    .login-submit {
      width: 100%;
      height: 46px;
      border-radius: 12px;
      font-size: 14.5px;
      font-weight: 700;
      letter-spacing: -0.01em;
      background: linear-gradient(95deg, #0066e6 0%, #0a84ff 52%, #14b8e8 100%);
      box-shadow: 0 10px 24px -8px rgba(0, 114, 245, 0.55);
    }
    .login-submit:hover:not(:disabled) {
      background: linear-gradient(95deg, #0057c7 0%, #0072f5 52%, #0ea5e9 100%);
      box-shadow: 0 14px 28px -8px rgba(0, 114, 245, 0.65);
    }

    .card-bottom-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      margin-top: 16px;
      padding-top: 14px;
      border-top: 1px solid #eef4fb;
    }
    .forgot-btn {
      background: none;
      border: none;
      padding: 0;
      color: #0b66f5;
      font-size: 12.5px;
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
    }
    .forgot-btn:hover { text-decoration: underline; }
    .card-copyright {
      font-size: 11.5px;
      color: #849bb5;
      font-weight: 500;
    }

    @media (max-width: 480px) {
      .login-card {
        padding: 26px 22px 24px;
        border-radius: 22px;
      }
      .card-brand {
        gap: 12px;
        padding-bottom: 18px;
        margin-bottom: 18px;
      }
      .brand-mark {
        width: 48px;
        height: 48px;
      }
      .brand-wordmark { font-size: 22px; }
      .card-bottom-row {
        flex-direction: column;
        align-items: center;
      }
    }
  `],
  template: `
<div class="login-stage" #stageRef (mousemove)="onPointerMove($event)">
  <!-- GSAP Animated Aquatic Background -->
  <div class="aquatic-backdrop" aria-hidden="true">
    <div class="water-rays"></div>

    <div class="parallax-layer" #parallaxRef>
      <div class="caustic-orb caustic-orb-1"></div>
      <div class="caustic-orb caustic-orb-2"></div>
      <div class="caustic-orb caustic-orb-3"></div>
    </div>

    <!-- Rising Crystalline Micro-Bubbles -->
    <div class="bubble-field">
      @for (b of bubbles; track b.id) {
        <div class="water-bubble"
             [attr.data-duration]="b.duration"
             [attr.data-delay]="b.delay"
             [attr.data-drift]="b.driftX"
             [attr.data-opacity]="b.opacity"
             [style.left.%]="b.leftPct"
             [style.width.px]="b.sizePx"
             [style.height.px]="b.sizePx"></div>
      }
    </div>

    <!-- Back Undulating Wave Layer -->
    <svg class="wave-band wave-band-back" viewBox="0 0 1440 220" preserveAspectRatio="none">
      <defs>
        <linearGradient id="gwWaveBack" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.45"/>
          <stop offset="100%" stop-color="#0284c7" stop-opacity="0.08"/>
        </linearGradient>
      </defs>
      <path d="M0,115 C180,55 360,175 540,115 C720,55 900,175 1080,115 C1260,55 1350,145 1440,115 L1440,220 L0,220 Z" fill="url(#gwWaveBack)"/>
    </svg>

    <!-- Front Undulating Wave Layer -->
    <svg class="wave-band wave-band-front" viewBox="0 0 1440 180" preserveAspectRatio="none">
      <defs>
        <linearGradient id="gwWaveFront" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#0ea5e9" stop-opacity="0.42"/>
          <stop offset="100%" stop-color="#0369a1" stop-opacity="0.12"/>
        </linearGradient>
      </defs>
      <path d="M0,90 C240,155 480,25 720,90 C960,155 1200,25 1440,90 L1440,180 L0,180 Z" fill="url(#gwWaveFront)"/>
    </svg>
  </div>

  <!-- Unified Container: Logo + Form Together -->
  <main class="login-shell">
    <section class="login-card" #cardRef aria-label="Connexion à GWater">
      <!-- Brand Lockup Inside Form Container -->
      <div class="card-brand">
        <div class="brand-mark" #dropletRef aria-hidden="true">
          <svg width="30" height="34" viewBox="0 0 36 40" fill="none">
            <defs>
              <linearGradient id="loginUnifiedDrop" x1="6" y1="2" x2="30" y2="38" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stop-color="#7ce0ff"/>
                <stop offset="48%" stop-color="#0ea5e9"/>
                <stop offset="100%" stop-color="#0052cc"/>
              </linearGradient>
            </defs>
            <path d="M18 2C18 2 4 17.5 4 26C4 33.732 10.268 39 18 39C25.732 39 32 33.732 32 26C32 17.5 18 2 18 2Z" fill="url(#loginUnifiedDrop)"/>
            <ellipse cx="14.2" cy="21" rx="2.1" ry="4.4" fill="#ffffff" opacity="0.78" transform="rotate(-18 14.2 21)"/>
          </svg>
        </div>
        <div class="brand-copy">
          <h1 class="brand-wordmark">GWater</h1>
          <p class="brand-slogan">Pureté &amp; Vitalité à chaque goutte</p>
        </div>
      </div>

      <div class="form-heading login-stagger">
        <h2>Connexion</h2>
        <p>Accédez à votre espace de gestion GWater</p>
      </div>

      @if (error()) {
        <div class="gw-alert alert-error" role="alert" style="margin-bottom:18px">
          <div class="alert-content">{{ error() }}</div>
        </div>
      }

      <form (ngSubmit)="onLogin()" #loginForm="ngForm">
        <div class="form-group login-stagger" style="margin-bottom:16px">
          <label for="login-email">Adresse e-mail</label>
          <div class="input-shell">
            <span class="input-icon" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
              </svg>
            </span>
            <input id="login-email"
                   type="email"
                   autocomplete="email"
                   class="form-control login-input"
                   placeholder="admin@gwater.com"
                   [(ngModel)]="email"
                   name="email"
                   required
                   [class.error]="emailError()">
          </div>
          @if (emailError()) {
            <span class="form-error">{{ emailError() }}</span>
          }
        </div>

        <div class="form-group login-stagger" style="margin-bottom:22px">
          <label for="login-password">Mot de passe</label>
          <div class="input-shell">
            <span class="input-icon" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </span>
            <input id="login-password"
                   [type]="showPwd() ? 'text' : 'password'"
                   autocomplete="current-password"
                   class="form-control login-input has-toggle"
                   placeholder="••••••••"
                   [(ngModel)]="password"
                   name="password"
                   required>
            <button type="button"
                    class="pwd-toggle"
                    [attr.aria-label]="showPwd() ? 'Masquer le mot de passe' : 'Afficher le mot de passe'"
                    (click)="showPwd.set(!showPwd())">
              @if (showPwd()) {
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
              } @else {
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                </svg>
              }
            </button>
          </div>
        </div>

        <div class="login-stagger">
          <button type="submit" class="btn btn-primary login-submit" [disabled]="loading()">
            @if (loading()) {
              <span class="loading-spinner" style="width:18px;height:18px;border-width:2px;margin:0;border-color:rgba(255,255,255,0.3);border-top-color:#ffffff"></span>
            } @else {
              <span>Se connecter</span>
            }
          </button>
        </div>
      </form>

      <div class="card-bottom-row login-stagger">
        <button type="button" class="forgot-btn" (click)="onForgotPassword()" [disabled]="resetting()">
          {{ resetting() ? 'Envoi en cours...' : 'Mot de passe oublié ?' }}
        </button>
        <span class="card-copyright">© 2026 GWater</span>
      </div>
    </section>
  </main>
</div>
  `
})
export class LoginComponent implements AfterViewInit {
  private readonly authService = inject(AuthService);
  private readonly toastService = inject(ToastService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  @ViewChild('stageRef', { static: true }) stageRef!: ElementRef<HTMLElement>;
  @ViewChild('cardRef', { static: true }) cardRef!: ElementRef<HTMLElement>;
  @ViewChild('dropletRef', { static: true }) dropletRef!: ElementRef<HTMLElement>;
  @ViewChild('parallaxRef', { static: true }) parallaxRef!: ElementRef<HTMLElement>;

  email = '';
  password = '';
  readonly error = signal('');
  readonly emailError = signal('');
  readonly loading = signal(false);
  readonly resetting = signal(false);
  readonly showPwd = signal(false);

  // Deterministic bubble specs for consistent visual rhythm
  readonly bubbles: WaterBubble[] = [
    { id: 1,  leftPct: 6,  sizePx: 14, duration: 9.5,  delay: 0.0, driftX: 18,  opacity: 0.55 },
    { id: 2,  leftPct: 14, sizePx: 24, duration: 13.0, delay: 1.8, driftX: -22, opacity: 0.42 },
    { id: 3,  leftPct: 22, sizePx: 10, duration: 8.5,  delay: 3.1, driftX: 14,  opacity: 0.62 },
    { id: 4,  leftPct: 31, sizePx: 18, duration: 11.2, delay: 0.7, driftX: -16, opacity: 0.46 },
    { id: 5,  leftPct: 40, sizePx: 12, duration: 10.4, delay: 4.5, driftX: 20,  opacity: 0.52 },
    { id: 6,  leftPct: 52, sizePx: 22, duration: 14.0, delay: 2.2, driftX: -24, opacity: 0.36 },
    { id: 7,  leftPct: 63, sizePx: 11, duration: 8.8,  delay: 1.1, driftX: 16,  opacity: 0.58 },
    { id: 8,  leftPct: 72, sizePx: 26, duration: 13.8, delay: 3.6, driftX: -20, opacity: 0.40 },
    { id: 9,  leftPct: 81, sizePx: 15, duration: 10.2, delay: 0.4, driftX: 18,  opacity: 0.54 },
    { id: 10, leftPct: 89, sizePx: 19, duration: 12.0, delay: 2.8, driftX: -14, opacity: 0.48 },
    { id: 11, leftPct: 94, sizePx: 11, duration: 9.2,  delay: 4.9, driftX: -12, opacity: 0.56 },
    { id: 12, leftPct: 27, sizePx: 9,  duration: 7.9,  delay: 5.4, driftX: 12,  opacity: 0.60 },
    { id: 13, leftPct: 67, sizePx: 16, duration: 11.6, delay: 6.1, driftX: 22,  opacity: 0.44 },
    { id: 14, leftPct: 47, sizePx: 13, duration: 9.8,  delay: 3.9, driftX: -15, opacity: 0.50 },
  ];

  private gsapCtx: gsap.Context | null = null;
  private moveParallaxX: ((v: number) => gsap.core.Tween) | null = null;
  private moveParallaxY: ((v: number) => gsap.core.Tween) | null = null;
  private reducedMotion = false;

  ngAfterViewInit(): void {
    if (typeof window === 'undefined') return;
    this.reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    if (this.reducedMotion) return;

    const stage = this.stageRef.nativeElement;

    this.gsapCtx = gsap.context(() => {
      // 1. Single orchestrated entrance sequence
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      tl.from(this.cardRef.nativeElement, {
        y: 26,
        scale: 0.965,
        opacity: 0,
        duration: 0.65,
      })
      .from(this.dropletRef.nativeElement, {
        scale: 0.65,
        rotate: -10,
        opacity: 0,
        duration: 0.55,
        ease: 'back.out(1.7)',
      }, '-=0.38')
      .from('.login-stagger', {
        y: 12,
        opacity: 0,
        duration: 0.42,
        stagger: 0.06,
      }, '-=0.34');

      // 2. Gentle living water-droplet breath
      gsap.to(this.dropletRef.nativeElement, {
        y: -3,
        duration: 2.6,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      });

      // 3. Breathing luminous caustic light orbs
      gsap.to('.caustic-orb-1', {
        x: 55,
        y: 35,
        scale: 1.12,
        duration: 9,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      });
      gsap.to('.caustic-orb-2', {
        x: -60,
        y: -40,
        scale: 1.15,
        duration: 11,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      });
      gsap.to('.caustic-orb-3', {
        x: -35,
        y: 45,
        scale: 0.9,
        opacity: 0.65,
        duration: 8,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      });

      // 4. Dual undulating translucent ocean waves
      gsap.to('.wave-band-back', {
        xPercent: -25,
        duration: 14,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      });
      gsap.to('.wave-band-front', {
        xPercent: -32,
        duration: 10,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      });

      // 5. Rising sparkling mineral-water micro-bubbles
      const bubbleEls = stage.querySelectorAll<HTMLElement>('.water-bubble');
      const travelY = -(window.innerHeight + 90);
      bubbleEls.forEach((el) => {
        const duration = Number(el.dataset['duration'] || 10);
        const delay = Number(el.dataset['delay'] || 0);
        const driftX = Number(el.dataset['drift'] || 16);
        const maxOpacity = Number(el.dataset['opacity'] || 0.5);

        gsap.set(el, { y: 0, opacity: 0, scale: 0.7 });
        gsap.to(el, {
          y: travelY,
          duration,
          delay,
          repeat: -1,
          ease: 'none',
          keyframes: [
            { opacity: maxOpacity, scale: 1, duration: duration * 0.2 },
            { opacity: maxOpacity, scale: 1.06, duration: duration * 0.6 },
            { opacity: 0, scale: 0.85, duration: duration * 0.2 },
          ],
        });
        gsap.to(el, {
          x: driftX,
          duration: duration * 0.35,
          delay,
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut',
        });
      });

      // 6. Smooth mouse-driven depth parallax on ambient orbs
      this.moveParallaxX = gsap.quickTo(this.parallaxRef.nativeElement, 'x', { duration: 0.9, ease: 'power2.out' });
      this.moveParallaxY = gsap.quickTo(this.parallaxRef.nativeElement, 'y', { duration: 0.9, ease: 'power2.out' });
    }, stage);

    this.destroyRef.onDestroy(() => {
      this.gsapCtx?.revert();
      this.gsapCtx = null;
    });
  }

  onPointerMove(event: MouseEvent): void {
    if (this.reducedMotion || !this.moveParallaxX || !this.moveParallaxY) return;
    const nx = (event.clientX / window.innerWidth - 0.5) * 2;
    const ny = (event.clientY / window.innerHeight - 0.5) * 2;
    this.moveParallaxX(nx * -22);
    this.moveParallaxY(ny * -16);
  }

  private shakeCardOnError(): void {
    if (this.reducedMotion || !this.cardRef?.nativeElement) return;
    gsap.fromTo(
      this.cardRef.nativeElement,
      { x: 0 },
      {
        keyframes: [
          { x: -7, duration: 0.06 },
          { x: 7, duration: 0.06 },
          { x: -5, duration: 0.06 },
          { x: 5, duration: 0.06 },
          { x: -2, duration: 0.05 },
          { x: 0, duration: 0.06 },
        ],
        ease: 'power2.inOut',
      }
    );
  }

  async onLogin(): Promise<void> {
    this.error.set('');
    this.emailError.set('');

    const email = this.email.trim();
    if (!email) {
      this.emailError.set('L\'e-mail est requis');
      this.shakeCardOnError();
      return;
    }
    if (!this.password) {
      this.error.set('Le mot de passe est requis');
      this.shakeCardOnError();
      return;
    }

    this.loading.set(true);
    try {
      await this.authService.login(email, this.password);
      this.toastService.success('Connexion réussie ! Bienvenue sur GWater.');
      await this.router.navigate(['/']);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      const msg: Record<string, string> = {
        'auth/user-not-found': 'Aucun compte avec cet e-mail.',
        'auth/wrong-password': 'Mot de passe incorrect.',
        'auth/invalid-credential': 'Email ou mot de passe incorrect.',
        'auth/account-disabled': 'Votre compte a été désactivé. Contactez un administrateur.',
        'auth/too-many-requests': 'Trop de tentatives. Réessayez plus tard.',
        'auth/network-request-failed': 'Erreur de connexion. Vérifiez votre réseau.',
      };
      this.error.set(msg[code] || 'Erreur de connexion. Vérifiez vos identifiants.');
      this.shakeCardOnError();
    } finally {
      this.loading.set(false);
    }
  }

  async onForgotPassword(): Promise<void> {
    const email = this.email.trim();
    if (!email) {
      this.emailError.set('Saisissez votre adresse e-mail pour recevoir le lien de réinitialisation.');
      this.shakeCardOnError();
      return;
    }
    this.resetting.set(true);
    try {
      await this.authService.sendPasswordReset(email);
      this.toastService.success(`Lien de réinitialisation envoyé à ${email}.`);
    } catch {
      this.toastService.error('Impossible d\'envoyer le lien. Vérifiez l\'adresse e-mail.');
    } finally {
      this.resetting.set(false);
    }
  }
}
