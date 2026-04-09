"use client"

import { motion, useMotionValue } from "framer-motion"
import { useState, useEffect, useRef, useCallback } from "react"

const CHAR_W = 50
const CHAR_H = 55
const SPEED = 0.07
const BOUNCE_SPEED = 0.26
const BOUNCE_DIST = 8
const GRAVITY = 0.045

type Phase = "moving" | "bouncing" | "paused" | "dropping" | "bounce_up" | "resting"

function randomVel() {
  const angle = Math.random() * Math.PI * 2
  return { x: Math.cos(angle) * SPEED, y: Math.sin(angle) * SPEED }
}

export function Character() {
  const [clickActive, setClickActive] = useState(false)
  const [tiltAngle, setTiltAngle]     = useState(0)
  const wanderX = useMotionValue(0)
  const wanderY = useMotionValue(0)
  const outerRef = useRef<HTMLDivElement>(null)

  const posRef       = useRef({ x: 0, y: 0 })
  const velRef       = useRef(randomVel())
  const phaseRef     = useRef<Phase>("moving")
  const boundsRef    = useRef({ x: 80, y: 25 })
  const bounceOrigin = useRef({ x: 0, y: 0 })
  const peakPassed   = useRef(false)

  // stable setter refs
  const setClickActiveRef = useRef(setClickActive)
  const setTiltAngleRef   = useRef(setTiltAngle)
  setClickActiveRef.current = setClickActive
  setTiltAngleRef.current   = setTiltAngle

  const handleClick = useCallback(() => {
    if (phaseRef.current === "dropping" ||
        phaseRef.current === "bounce_up" ||
        phaseRef.current === "resting") return
    setClickActiveRef.current(true)
    setTiltAngleRef.current(0)
    phaseRef.current = "dropping"
    velRef.current   = { x: 0, y: 0.5 }
  }, [])

  useEffect(() => {
    const parent = outerRef.current?.parentElement
    boundsRef.current = {
      x: parent ? parent.clientWidth  / 2 - 6 : 80,
      y: parent ? parent.clientHeight / 2 - 6 : 25,
    }

    velRef.current   = randomVel()
    phaseRef.current = "moving"

    const startPause = (onDone?: () => void) => {
      phaseRef.current  = "paused"
      velRef.current    = { x: 0, y: 0 }
      setTimeout(() => {
        velRef.current   = randomVel()
        phaseRef.current = "moving"
        onDone?.()
      }, 800 + Math.random() * 700)
    }

    const enterResting = () => {
      phaseRef.current = "resting"
      velRef.current   = { x: 0, y: 0 }

      // tilt는 이미 bounce_up 낙하 시작 시 설정됨 — 여기선 대기 후 복귀만
      setTimeout(() => {
        setTiltAngleRef.current(0)
        setTimeout(() => {
          velRef.current   = randomVel()
          phaseRef.current = "moving"
          setClickActiveRef.current(false)
        }, 400)
      }, 800 + Math.random() * 700)
    }

    let frameId: number
    const loop = () => {
      const pos    = posRef.current
      const vel    = velRef.current
      const bounds = boundsRef.current
      const phase  = phaseRef.current

      if (phase === "moving") {
        pos.x += vel.x
        pos.y += vel.y

        let hit = false
        if (pos.x >= bounds.x)  { pos.x = bounds.x;  vel.x = -Math.abs(vel.x); hit = true }
        if (pos.x <= -bounds.x) { pos.x = -bounds.x; vel.x =  Math.abs(vel.x); hit = true }
        if (pos.y >= bounds.y)  { pos.y = bounds.y;  vel.y = -Math.abs(vel.y); hit = true }
        if (pos.y <= -bounds.y) { pos.y = -bounds.y; vel.y =  Math.abs(vel.y); hit = true }

        if (hit) {
          const len = Math.sqrt(vel.x ** 2 + vel.y ** 2) || 1
          vel.x = (vel.x / len) * BOUNCE_SPEED
          vel.y = (vel.y / len) * BOUNCE_SPEED
          phaseRef.current     = "bouncing"
          bounceOrigin.current = { ...pos }
        }

      } else if (phase === "bouncing") {
        pos.x += vel.x
        pos.y += vel.y

        const dist = Math.sqrt(
          (pos.x - bounceOrigin.current.x) ** 2 +
          (pos.y - bounceOrigin.current.y) ** 2
        )
        if (dist >= BOUNCE_DIST) startPause()

      } else if (phase === "dropping") {
        vel.y += GRAVITY
        pos.y += vel.y

        if (pos.y >= bounds.y) {
          pos.y = bounds.y
          vel.y = -Math.abs(vel.y) * 0.45
          vel.x = 0
          phaseRef.current = "bounce_up"
          peakPassed.current = false
        }

      } else if (phase === "bounce_up") {
        vel.y += GRAVITY
        pos.y += vel.y

        // 정점 지나 다시 내려오는 순간 기울기 시작
        if (!peakPassed.current && vel.y >= 0) {
          peakPassed.current = true
          const tilt = (Math.random() > 0.5 ? 1 : -1) * (8 + Math.random() * 12)
          setTiltAngleRef.current(tilt)
        }

        if (pos.y >= bounds.y) {
          pos.y = bounds.y
          vel.y = 0
          enterResting()
        }

      }
      // resting은 RAF만 돌고 위치 고정

      wanderX.set(pos.x)
      wanderY.set(pos.y)
      frameId = requestAnimationFrame(loop)
    }

    frameId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frameId)
  }, [])

  return (
    <motion.div
      ref={outerRef}
      className="relative flex items-end justify-center w-[50px] h-[55px]"
      style={{ x: wanderX, y: wanderY }}
    >
      {/* Shadow */}
      <motion.div
        className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-[35px]"
        animate={{ scale: [1, 0.88, 1], opacity: [0.35, 0.2, 0.35] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      >
        <svg viewBox="0 0 277 59" fill="none" xmlns="http://www.w3.org/2000/svg">
          <ellipse cx="138.5" cy="29.5" rx="138.5" ry="29.5" fill="#D9D9D9"/>
        </svg>
      </motion.div>

      {/* Character */}
      <motion.div
        className="absolute bottom-1 left-1/2 -translate-x-1/2 w-[45px] cursor-pointer"
        animate={
          clickActive
            ? { rotate: tiltAngle, y: 0 }
            : { y: [0, -6, 0], rotate: 0 }
        }
        transition={
          clickActive
            ? { rotate: { duration: 0.35, ease: "easeOut" } }
            : { duration: 4, repeat: Infinity, ease: "easeInOut" }
        }
        onClick={handleClick}
      >
        {/* Body */}
        <svg viewBox="0 0 470 461" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto">
          <circle cx="242" cy="228" r="220.5" fill="#D9F4CD"/>
          <path d="M28.5 263.5V253.5L21.5 241.5V227.5V210.5L28.5 197.5V179.5L21.5 161.5L28.5 151.5V136.5L45.5 123.5L56.5 109.5H64.5L72.5 92.5L79.5 72.5L93.5 61.5L105.5 55.5H117.5V44.5L133.5 39.5H140.5L149.5 26.5H164.5L175.5 18.5H193.5L202.5 26.5L217.5 18.5H232.5L238.5 7.5H251.5H259.5L268.5 18.5H287.5L302.5 26.5L319.5 34.5H329.5H343.5L357.5 44.5L369.5 55.5L384.5 67.5H392.5L408.5 72.5L415.5 85.5V92.5L408.5 109.5L415.5 114.5L430.5 123.5" stroke="#97B48B" strokeWidth="15" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M447.5 173.5V196.5L453.5 209.5L447.5 226.5V237.5L453.5 252.5L462.5 260.5L453.5 271.5L447.5 285.5V300.5L440.5 313.5V325.5L428.5 333.5L419.5 345.5L413.5 355.5V368.5L406.5 376.5M43.5 308.5L53.5 325.5L60.5 340.5L71.5 355.5L78.5 376.5L85.5 389.5V402.5L106.5 411.5H124.5L129.5 423.5H149.5L157.5 428.5L167.5 441.5H183.5H201.5L213.5 453.5H224.5L232.5 441.5L245.5 435.5L255.5 441.5H262.5H280.5L290.5 435.5L299.5 428.5L310.5 435.5L317.5 441.5V428.5L333.5 423.5L344.5 411.5H357.5M434.5 141.5H447.5L453.5 135.5M434.5 158.5H453.5M393.5 389.5V397.5L399.5 402.5M370.5 389.5L376.5 402.5L386.5 416.5M7.5 285.5H23.5L38.5 278.5M12.5 305.5H23.5L32.5 300.5H43.5" stroke="#97B48B" strokeWidth="15" strokeLinecap="round" strokeLinejoin="round"/>
          <circle cx="257" cy="234" r="134.5" fill="#CFEFC2"/>
        </svg>

        {/* Eye — 깜빡임 */}
        <motion.div
          className="absolute top-[43%] left-1/2 -translate-x-1/2 w-[48%]"
          animate={{ scaleY: [1, 1, 0.35, 1] }}
          transition={{ duration: 3, repeat: Infinity, repeatDelay: 2, ease: "easeInOut" }}
          style={{ transformOrigin: "center" }}
        >
          <svg viewBox="0 0 232 59" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto">
            <circle cx="29.5" cy="29.5" r="29.5" fill="#6b8a52"/>
            <circle cx="202.5" cy="29.5" r="29.5" fill="#6b8a52"/>
          </svg>
        </motion.div>

        {/* Hair */}
        <motion.div
          className="absolute top-[8%] -left-[6%] w-[116%]"
          animate={clickActive ? {} : { y: [0, -6, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 0.05 }}
        >
          <svg viewBox="0 0 546 379" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto">
            <path d="M76.5 7.50183L86 28.5018M39 28.5018L50 45.0018M7.5 87.5018H29.5M511 289.002H522H530.5L538.5 297.002M498.5 320.502L511 328.502L522 335.502M474 355.002L482.5 365.502L486.5 371.002" stroke="#97B48B" strokeWidth="15" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </motion.div>
      </motion.div>
    </motion.div>
  )
}
