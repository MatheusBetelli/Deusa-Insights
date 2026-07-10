import { NgIf } from "@angular/common";
import { Component, inject } from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { Router } from "@angular/router";
import { finalize } from "rxjs";
import { AuthService } from "../../core/services/auth.service";

@Component({
  selector: "app-login-page",
  standalone: true,
  imports: [NgIf, ReactiveFormsModule],
  template: `
    <main class="login-page">
      <section class="brand-panel">
        <div class="brand-mark">Deusa Analytics</div>
        <h1>Inteligencia comercial com dados reais</h1>
        <p>Base Angular paralela para migracao segura, conectada ao backend NestJS.</p>
      </section>

      <section class="form-panel" aria-labelledby="login-title">
        <form [formGroup]="form" (ngSubmit)="submit()" class="login-card">
          <p class="eyebrow">Acesso interno</p>
          <h2 id="login-title">Entrar na plataforma</h2>
          <p class="hint">Use as credenciais reais do backend local.</p>

          <label>
            <span>E-mail</span>
            <input type="email" formControlName="email" autocomplete="email" />
          </label>

          <label>
            <span>Senha</span>
            <input type="password" formControlName="password" autocomplete="current-password" />
          </label>

          <div *ngIf="error" class="error">{{ error }}</div>

          <button type="submit" [disabled]="form.invalid || loading">
            {{ loading ? "Entrando..." : "Entrar com backend real" }}
          </button>
        </form>
      </section>
    </main>
  `,
  styles: `
    .login-page {
      display: grid;
      min-height: 100vh;
      grid-template-columns: minmax(320px, 0.85fr) minmax(360px, 1fr);
      background: #f8fafc;
    }

    .brand-panel {
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding: 56px;
      background: #061527;
      color: white;
    }

    .brand-mark {
      margin-bottom: 72px;
      color: #fff200;
      font-size: 13px;
      font-weight: 800;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }

    h1 {
      max-width: 460px;
      margin: 0;
      font-size: 36px;
      line-height: 1.16;
    }

    .brand-panel p {
      max-width: 440px;
      color: rgba(226, 232, 240, 0.76);
      font-size: 15px;
      line-height: 1.7;
    }

    .form-panel {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 32px;
    }

    .login-card {
      width: min(100%, 440px);
      border: 1px solid #dde5ef;
      border-radius: 14px;
      background: white;
      padding: 36px;
      box-shadow: 0 30px 70px -28px rgba(15, 23, 42, 0.28);
    }

    .eyebrow {
      margin: 0 0 8px;
      color: #1061af;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    h2 {
      margin: 0;
      font-size: 24px;
    }

    .hint {
      margin: 8px 0 28px;
      color: #64748b;
      font-size: 14px;
    }

    label {
      display: grid;
      gap: 8px;
      margin-bottom: 16px;
      color: #0b1f33;
      font-size: 12px;
      font-weight: 800;
      text-transform: uppercase;
    }

    input {
      height: 44px;
      border: 1px solid #dde5ef;
      border-radius: 10px;
      padding: 0 12px;
      color: #0b1f33;
      font-size: 15px;
      outline: none;
      text-transform: none;
    }

    input:focus {
      border-color: #1061af;
      box-shadow: 0 0 0 3px rgba(16, 97, 175, 0.12);
    }

    .error {
      margin: 8px 0 16px;
      border: 1px solid #fca5a5;
      border-radius: 10px;
      background: #fef2f2;
      color: #991b1b;
      padding: 10px 12px;
      font-size: 13px;
      font-weight: 700;
    }

    button {
      width: 100%;
      height: 46px;
      border: 0;
      border-radius: 10px;
      background: #1061af;
      color: white;
      cursor: pointer;
      font-size: 15px;
      font-weight: 800;
    }

    button:disabled {
      cursor: not-allowed;
      opacity: 0.65;
    }

    @media (max-width: 820px) {
      .login-page {
        grid-template-columns: 1fr;
      }

      .brand-panel {
        display: none;
      }
    }
  `,
})
export class LoginPageComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  loading = false;
  error = "";

  readonly form = this.formBuilder.nonNullable.group({
    email: ["rafael.mendes@deusa.com.br", [Validators.required, Validators.email]],
    password: ["deusa123", [Validators.required]],
  });

  submit(): void {
    if (this.form.invalid || this.loading) return;

    this.loading = true;
    this.error = "";

    this.auth
      .login(this.form.getRawValue())
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: () => this.router.navigateByUrl("/app"),
        error: (error: unknown) => {
          this.error = error instanceof Error ? error.message : "Nao foi possivel entrar.";
        },
      });
  }
}
