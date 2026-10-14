/**
 * 坦克大战 - 掉落道具管理系统
 */
class PowerUp {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.type = type; // CONFIG.POWERUP
    this.width = 32;
    this.height = 32;
    this.timer = 0;
    this.duration = 20; // 存留20秒
    this.collected = false;
    this.blinkSpeed = 8; // 闪烁频率
  }

  update(dt) {
    this.timer += dt;
    if (this.timer >= this.duration) {
      this.collected = true; // 超时自然消失
    }
  }

  collidesWith(tank) {
    return (
      this.x < tank.x + tank.width &&
      this.x + this.width > tank.x &&
      this.y < tank.y + tank.height &&
      this.y + this.height > tank.y
    );
  }

  render(ctx) {
    if (this.collected) return;
    // 闪烁效果 (经典FC闪烁)
    if (Math.floor(this.timer * this.blinkSpeed) % 2 === 0) {
      // 保持微透明或微弱光晕
    }

    const cx = this.x + this.width / 2;
    const cy = this.y + this.height / 2;

    ctx.save();
    // 道具底座暗背景圆角框
    ctx.fillStyle = '#2d3436';
    ctx.fillRect(this.x, this.y, this.width, this.height);
    ctx.strokeStyle = '#ffeaa7';
    ctx.lineWidth = 2;
    ctx.strokeRect(this.x + 1, this.y + 1, this.width - 2, this.height - 2);

    switch (this.type) {
      case CONFIG.POWERUP.STAR:
        // 五角星 🌟
        ctx.fillStyle = '#f1c40f';
        this.drawStar(ctx, cx, cy, 5, 12, 6);
        break;

      case CONFIG.POWERUP.BOMB:
        // 炸弹 💣
        ctx.fillStyle = '#e74c3c';
        ctx.beginPath();
        ctx.arc(cx, cy + 2, 9, 0, Math.PI * 2);
        ctx.fill();
        // 引信
        ctx.strokeStyle = '#f39c12';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy - 7);
        ctx.lineTo(cx + 4, cy - 12);
        ctx.stroke();
        // 火花
        ctx.fillStyle = '#fff';
        ctx.fillRect(cx + 4, cy - 13, 2, 2);
        break;

      case CONFIG.POWERUP.CLOCK:
        // 定时闹钟 ⏰
        ctx.fillStyle = '#3498db';
        ctx.beginPath();
        ctx.arc(cx, cy, 10, 0, Math.PI * 2);
        ctx.fill();
        // 表盘针
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx, cy - 6);
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + 5, cy);
        ctx.stroke();
        break;

      case CONFIG.POWERUP.SHOVEL:
        // 铁铲 ⛏️
        ctx.fillStyle = '#bdc3c7';
        // 铲面
        ctx.beginPath();
        ctx.arc(cx, cy - 2, 7, Math.PI, 0, false);
        ctx.fill();
        // 铲柄
        ctx.strokeStyle = '#e67e22';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(cx, cy - 2);
        ctx.lineTo(cx, cy + 10);
        ctx.stroke();
        break;

      case CONFIG.POWERUP.HELMET:
        // 钢盔/防护盾 🛡️
        ctx.fillStyle = '#9b59b6';
        ctx.beginPath();
        ctx.arc(cx, cy - 2, 10, Math.PI, 0);
        ctx.lineTo(cx, cy + 11);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(cx - 3, cy, 6, 4);
        break;

      case CONFIG.POWERUP.TANK:
        // 奖命小坦克 💖
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(cx - 7, cy - 6, 14, 12);
        // 履带与炮管
        ctx.fillStyle = '#27ae60';
        ctx.fillRect(cx - 9, cy - 8, 4, 16);
        ctx.fillRect(cx + 5, cy - 8, 4, 16);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(cx - 1, cy - 10, 2, 6);
        break;
    }

    ctx.restore();
  }

  drawStar(ctx, cx, cy, spikes, outerRadius, innerRadius) {
    let rot = (Math.PI / 2) * 3;
    let x = cx;
    let y = cy;
    let step = Math.PI / spikes;

    ctx.beginPath();
    ctx.moveTo(cx, cy - outerRadius);
    for (let i = 0; i < spikes; i++) {
      x = cx + Math.cos(rot) * outerRadius;
      y = cy + Math.sin(rot) * outerRadius;
      ctx.lineTo(x, y);
      rot += step;

      x = cx + Math.cos(rot) * innerRadius;
      y = cy + Math.sin(rot) * innerRadius;
      ctx.lineTo(x, y);
      rot += step;
    }
    ctx.lineTo(cx, cy - outerRadius);
    ctx.closePath();
    ctx.fill();
  }
}
